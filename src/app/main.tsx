import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const OpsApp = lazy(async () => ({ default: (await import('./OpsApp')).OpsApp }));

const mount = document.getElementById('root');

if (!mount) throw new Error('app_mount_missing');

const isOperationsRoute = window.location.pathname.replace(/\/$/, '').endsWith('/ops');

createRoot(mount).render(
  <StrictMode>
    {isOperationsRoute ? <Suspense fallback={null}><OpsApp /></Suspense> : <App />}
  </StrictMode>
);
