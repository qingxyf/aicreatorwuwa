import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Toy pages are served from /toy/<slug>/, so local assets must stay relative
  // to the published package instead of resolving from the site root.
  base: process.env.VITE_TOY_BASE_PATH ?? './',
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
});
