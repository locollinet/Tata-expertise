import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

// Ignore WebSocket / HMR errors per environment constraints
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const r = event.reason;
    const msg = (r && (r.message || r.stack || String(r))) || '';
    if (msg.includes('WebSocket') || msg.includes('ws') || (r && r.stack && r.stack.includes('@vite/client'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
