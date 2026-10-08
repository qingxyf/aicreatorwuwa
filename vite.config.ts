import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { verifyExhibitionArchive } from './scripts/export-exhibition.mjs';

const exhibitionPlugin: Plugin = {
  name: 'static-exhibition',
  buildStart: async () => { await verifyExhibitionArchive(process.cwd()); },
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => {
      if (!html.includes('/src/app/main.tsx')) throw new Error('Public entrypoint changed; review exhibition build routing');
      return html.replace('/src/app/main.tsx', '/src/app/exhibition-main.tsx')
        .replace(/<script[^>]*src="https:\/\/s1\.hdslb\.com\/bfs\/seed\/toy\/app\/sdk\/toy-sdk\.js"[^>]*><\/script>/, '')
        .replace('<title>鸣潮 AI 二创主题征集</title>', '<title>衣锦还裳 · 鸣潮 AI 二创作品展</title>');
    }
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Toy pages are served from /toy/<slug>/, so local assets must stay relative
  // to the published package instead of resolving from the site root.
  const staticPreview = env.VITE_STATIC_PREVIEW === 'true';
  const exhibition = mode === 'exhibition';
  if ((mode === 'production' || mode === 'toy') && !staticPreview && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required for production builds; use VITE_STATIC_PREVIEW=true only for a static demo build.');
  }

  return {
    base: env.VITE_TOY_BASE_PATH ?? './',
    build: {
      rollupOptions: {
        input: exhibition ? 'index.html' : {
          main: 'index.html',
          ops: 'ops.html'
        }
      }
    },
    plugins: [react(), ...(exhibition ? [exhibitionPlugin] : [])],
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}']
    }
  };
});
