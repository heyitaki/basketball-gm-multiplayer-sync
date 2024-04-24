import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.createElement('div');
root.id = 'sink-root';
document.body.appendChild(root);

const shadowRoot = root.attachShadow({ mode: 'open' });
const div = document.createElement('div');
div.id = 'sink-shadow-root';
shadowRoot.appendChild(div);

ReactDOM.createRoot(div).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
