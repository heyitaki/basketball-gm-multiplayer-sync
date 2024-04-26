import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.scss';
import { App } from './App.tsx';

ReactDOM.createRoot(document.getElementById('sink-app-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
