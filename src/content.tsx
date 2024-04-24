import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './AppWrapper';
import './content.scss';

const root = document.createElement('div');
root.id = 'sink-shadow-root';
document.body.appendChild(root);

const shadowRoot = root.attachShadow({ mode: 'open' });
// const div = document.createElement('div');
// div.id = 'sink-app-root';
// shadowRoot.appendChild(div);

ReactDOM.createRoot(shadowRoot).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
