import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Toy pages are served from /toy/<slug>/, so local assets must stay relative
  // to the published package instead of resolving from the site root.
  const staticPreview = env.VITE_STATIC_PREVIEW === 'true';
  if ((mode === 'production' || mode === 'toy') && !staticPreview && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required for production builds; use VITE_STATIC_PREVIEW=true only for a static demo build.');
  }

  return {
    base: env.VITE_TOY_BASE_PATH ?? './',
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          ops: 'ops.html'
        }
      }
    },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}']
    }
  };
});
