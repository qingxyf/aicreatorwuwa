import '@ant-design/v5-patch-for-react-19';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isOperationsRoute } from './route';

const OpsApp = lazy(async () => ({ default: (await import('./OpsApp')).OpsApp }));

const mount = document.getElementById('root');

if (!mount) throw new Error('app_mount_missing');

createRoot(mount).render(
  <StrictMode>
    {isOperationsRoute(window.location.pathname) ? <Suspense fallback={null}><OpsApp /></Suspense> : <App />}
  </StrictMode>
);
