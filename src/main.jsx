/**
 * Application entry point.
 *
 * Mounts the router above <App /> so every provider inside it can use the
 * navigation hooks, and pulls in the single stylesheet that @imports the rest.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
