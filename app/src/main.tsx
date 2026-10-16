import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme/tokens.css';
import './theme/base.css';
import './theme/desk.css';
import './theme/panels.css';
import './theme/screens.css';
import './theme/art.css';
import './theme/round9.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
