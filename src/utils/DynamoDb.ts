import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  DynamoDBDocument,
} from '@aws-sdk/lib-dynamodb';
import { getEnvironmentVariable } from './env';
import { sleep } from './sleep';

export class DynamoDb<T extends Record<string, any>> {
  client: DynamoDBDocument;
  partitionKeyName: string;
  tableName: string;

  // This constructor is private because we want to force the use of the static
  // `from` method so that we can ensure that the table exists
  private constructor(tableName: string, partitionKeyName: string) {
    this.tableName = tableName;
    this.partitionKeyName = partitionKeyName;
    this.client = DynamoDBDocument.from(
      new DynamoDBClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: getEnvironmentVariable('VITE_AWS_ACCESS_KEY_ID'),
          secretAccessKey: getEnvironmentVariable('VITE_AWS_SECRET_ACCESS_KEY'),
        },
      }),
      {
        marshallOptions: {
          removeUndefinedValues: false,
        },
      },
    );

    // TODO: check if partitionKey is correct for given tableName
  }

  async exists(): Promise<boolean> {
    try {
      await this.client.send(
        new DescribeTableCommand({
          TableName: this.tableName,
        }),
      );
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'ResourceNotFoundException') {
        return false;
      } else {
        throw e;
      }
    }
  }

  async forceGet(keys: string[]): Promise<T[]> {
    const objects = await this.get(keys);
    const missingKeys = keys.filter((key, i) => objects[i] === undefined);
    if (missingKeys.length > 0) {
      const missingKeysStr = missingKeys.join(', ');
      throw new Error(
        `Could not find keys ${missingKeysStr} in table ${this.tableName}`,
      );
    }

    return objects as T[];
  }

  async forceGetOne(key: string): Promise<T> {
    return (await this.forceGet([key]))[0];
  }

  async get(keys: string[]): Promise<(T | undefined)[]> {
    if (keys.length === 0) {
      return [];
    }

    const response = await this.client.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: keys.map((key) => ({ [this.partitionKeyName]: key })),
          },
        },
      }),
    );
    const results = response.Responses?.[this.tableName] as T[];
    if (!results) {
      const resJson = JSON.stringify(response);
      throw new Error(
        `Could not find table ${this.tableName} in response: ${resJson}`,
      );
    }

    // Sort results in input keys order
    const resultsMap = new Map(
      results.map((result) => [(result as any)[this.partitionKeyName], result]), // TODO: fix any
    );
    return keys.map((key) => {
      // TODO: use zod to validate results
      const res = resultsMap.get(key);
      if (!res) {
        console.error(
          `Could not find chunk with id ${key} in table ${this.tableName}`,
        );
      }

      return res;
    });
  }

  async getOne(key: string): Promise<T | undefined> {
    return (await this.get([key]))[0];
  }

  async put(items: T[], retryLimit = 5) {
    const writeRequests = items.map((item) => ({
      PutRequest: {
        Item: item,
      },
    }));

    // TODO: handle 25 command limit
    const command = new BatchWriteCommand({
      RequestItems: {
        [this.tableName]: writeRequests,
      },
    });

    try {
      const response = await this.client.send(command);

      // Handle failures
      const unprocessedItems = response.UnprocessedItems?.[this.tableName];
      if (unprocessedItems) {
        if (retryLimit > 0) {
          // Wait and retry
          await sleep(1000);
          await this.put(unprocessedItems as T[], retryLimit - 1);
        } else {
          const unprocessedItemsStr = JSON.stringify(unprocessedItems, null, 2);
          throw new Error(
            `Max retries exceeded. Failed to process ${unprocessedItems.length} / ${items.length} items: ${unprocessedItemsStr}`,
          );
        }
      }
    } catch (error) {
      // TODO: should we raise this error?
      console.error('Error occurred while putting items:', error);
    }
  }

  async putOne(item: T) {
    await this.put([item]);
  }

  static async from<T extends Record<string, any>>(
    tableName: string,
    partitionKey: string,
  ): Promise<DynamoDb<T>> {
    const db = new DynamoDb<T>(tableName, partitionKey);
    if (!(await db.exists())) {
      console.log(`Table ${tableName} does not exist. Creating...`);
      await db.create();
    }

    return db;
  }

  static async fromIfExists<T extends Record<string, any>>(
    tableName: string,
    partitionKey: string,
  ): Promise<DynamoDb<T> | undefined> {
    const db = new DynamoDb<T>(tableName, partitionKey);
    return (await db.exists()) ? db : undefined;
  }

  private async create() {
    await this.client.send(
      new CreateTableCommand({
        TableName: this.tableName,
        KeySchema: [
          {
            AttributeName: this.partitionKeyName,
            KeyType: 'HASH',
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: this.partitionKeyName,
            AttributeType: 'S',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );

    // Wait for table to be created
    let tableStatus: string | undefined;
    do {
      const res = await this.client.send(
        new DescribeTableCommand({
          TableName: this.tableName,
        }),
      );
      tableStatus = res.Table?.TableStatus;
      if (tableStatus !== 'ACTIVE') {
        // Wait before checking the status again
        await new Promise((r) => setTimeout(r, 5000));
      }
    } while (tableStatus !== 'ACTIVE');
  }
}
