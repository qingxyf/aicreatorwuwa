import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_TOY_BASE_PATH ?? '/',
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
