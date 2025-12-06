import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPWA } from './pwa-register';

// Register PWA service worker
registerPWA();

// Cache busting for development
if (import.meta.env.DEV) {
  // Prevent caching issues in development
  const timestamp = Date.now();
  console.log(`🔄 App initialized at ${new Date(timestamp).toISOString()}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
