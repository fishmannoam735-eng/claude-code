import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router';
import './index.css';
import { App } from './App';

/**
 * Paths are the default, because `/g/<seed>` is a link worth sharing and a
 * challenge link *is* the puzzle. A hash build exists for hosts that cannot
 * rewrite unknown paths to index.html — open one on a static file host and
 * every deep link 404s on refresh.
 */
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
