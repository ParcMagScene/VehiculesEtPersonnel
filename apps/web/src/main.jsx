import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './theme.css';
import './design/tokens.css';
import './design/utilities.css';
import './theme-palettes.css';
import './theme-vscode.css';
import './theme-density.css';
import './theme-tv.css';
import './index.css';

// A11y: Allow keyboard activation (Enter/Space) on elements with role="button"
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
    e.preventDefault();
    e.target.click();
  }
});

// Global: capture unhandled promise rejections to avoid silent failures
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
