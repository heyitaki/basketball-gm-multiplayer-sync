import { useEffect, useState } from 'react';
import { DynamoDb } from './utils/DynamoDb';
import { sleep } from './utils/sleep';

type Status = 'idle' | 'pushing' | 'pulling' | 'error';

export function App() {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    (async () => {
      if (status === 'pushing') {
        const success = await push();
        setStatus(success ? 'idle' : 'error');
      } else if (status === 'pulling') {
        const success = await pull();
        setStatus(success ? 'idle' : 'error');
      }
    })();
  }, [status]);

  return (
    <div
      id="sink-app-root"
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        width: '250px',
      }}
    >
      <p>{getStatusText(status)}</p>
      <div>
        <button onClick={() => setStatus('pulling')}>Pull</button>
        <button onClick={() => setStatus('pushing')}>Push</button>
      </div>
    </div>
  );
}

async function pull() {
  try {
    // Get link
    const db = await DynamoDb.from<{ id: string; link: string }>('sink', 'id');
    let link: string;
    try {
      link = (await db.forceGetOne('0')).link;
    } catch (error) {
      console.error('Error occurred while pulling:', error);
      return false;
    }

    // Get import href
    const num = window.location.pathname.split('/')[2];
    const href = `/new_league/${num}`;

    // Go to league list
    (document.querySelector('a.navbar-brand') as HTMLAnchorElement).click();
    await sleep(1000);

    // Open dropdown
    const row = Array.from(document.querySelectorAll('a.btn')).find((el) =>
      (el as HTMLAnchorElement).href.endsWith(`/l/${num}`),
    )?.parentElement?.parentElement;
    (
      row?.querySelector('td:last-child > div > span') as HTMLDivElement
    )?.click();
    await sleep(100);

    // Get anchor element with href equal to href
    (
      Array.from(row?.querySelectorAll('a') || []).find((el) =>
        (el as HTMLAnchorElement).href.endsWith(href),
      ) as HTMLAnchorElement
    )?.click();
    await sleep(1000);

    // Switch customize option to "Enter league file URL"
    const select = document.querySelector('select option[value="custom-url"]')
      ?.parentElement as HTMLSelectElement;
    select.value = 'custom-url';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);

    // Fill link
    const input = document.querySelector(
      'input[placeholder="URL"]',
    ) as HTMLInputElement;
    if (input) {
      input.value = link;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(100);
    }

    // Load JSON from Dropbox
    (
      Array.from(document.querySelectorAll('button.btn')).find(
        (e) => e.textContent === 'Load',
      ) as HTMLButtonElement
    )?.click();

    // Wait for JSON to load
    while (document.querySelector('p.alert-success')?.textContent !== 'Done!') {
      await sleep(1000);
    }

    // Import league
    (
      Array.from(document.querySelectorAll('button.btn')).find(
        (e) => e.textContent === 'Import League',
      ) as HTMLButtonElement
    )?.click();
    await sleep(100);

    // Confirm import
    (
      Array.from(
        document.querySelectorAll('div[role="dialog"] button.btn'),
      ).find((e) => e.textContent === 'Import League') as HTMLButtonElement
    )?.click();

    return true;
  } catch (error) {
    console.log('Error occurred while pulling:', error);
    return false;
  }
}

async function push() {
  try {
    // Get current URL
    const url = window.location.href;

    // Make sure sidebar is open
    if (!document.querySelector('body')?.classList.contains('modal-open')) {
      const button = document.querySelector(
        'button.navbar-toggler',
      ) as HTMLButtonElement;
      button.click();
      await sleep(100);
    }

    // Select navbar link by text "Export League"
    const exportButton = Array.from(
      document.querySelectorAll('a.nav-link'),
    ).find((el) => el.textContent === 'Export League') as HTMLButtonElement;
    exportButton.click();
    await sleep(100);

    // Select "Save to Dropbox" button
    const saveButton = Array.from(
      document.querySelectorAll('button.btn-primary'),
    ).find((el) => el.textContent === ' Save to Dropbox') as HTMLButtonElement;
    saveButton.click();

    // Wait for upload
    while (
      document.querySelector('p.text-success')?.textContent !==
      'Upload complete!'
    ) {
      await sleep(1000);
    }

    // Get download link
    const link = Array.from(document.querySelectorAll('p'))
      .find((el) => el.textContent?.includes('URL:'))
      ?.querySelector('a')
      ?.getAttribute('href');

    // Store link
    const db = await DynamoDb.from('sink', 'id');
    if (link) {
      await db.putOne({ id: '0', link });
    }

    // Restore URL
    window.location.href = url;

    return true;
  } catch (error) {
    console.error('Error occurred while pushing:', error);
    return false;
  }
}

function getStatusText(status: Status) {
  switch (status) {
    case 'idle':
      return 'Sync state';
    case 'pushing':
      return 'Pushing...';
    case 'pulling':
      return 'Pulling...';
    case 'error':
      return 'Error';
  }
}
