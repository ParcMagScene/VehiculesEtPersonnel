import './theme.css';
import './design/tokens.css';
import './design/utilities.css';
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ScrollToTopOnModuleChange } from './router/RouterCompat.jsx';

const startOptionalThemeLoaders = () => {
  const root = document.documentElement;
  const hasThemeAttributes =
    !!root.getAttribute('data-palette') || !!root.getAttribute('data-density');

  const run = () => {
    import('./theme/loadOptionalPaletteStyles.js')
      .then(({ setupOptionalPaletteStyleLoader }) => {
        setupOptionalPaletteStyleLoader();
      })
      .catch((error) => {
        console.error('[theme-loader]', error);
      });
  };

  if (hasThemeAttributes) {
    run();
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run);
    return;
  }

  window.setTimeout(run, 0);
};

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

startOptionalThemeLoaders();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* [Sprint A] BrowserRouter posé à la racine — fondation non-cassante.
        App.jsx continue de gérer activeModule en state, mais peut désormais
        utiliser useSearchParams/useNavigate dans les sprints suivants. */}
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollToTopOnModuleChange />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
