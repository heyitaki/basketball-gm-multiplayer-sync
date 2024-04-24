import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('sink-app-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
