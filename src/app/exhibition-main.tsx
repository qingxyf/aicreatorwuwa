import '@ant-design/v5-patch-for-react-19';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExhibitionApp } from './ExhibitionApp';

const mount = document.getElementById('root');
if (!mount) throw new Error('app_mount_missing');

createRoot(mount).render(<StrictMode><ExhibitionApp /></StrictMode>);
