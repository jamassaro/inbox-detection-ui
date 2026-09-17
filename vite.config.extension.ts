import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // root is chrome-extension/ so popup/index.html resolves correctly
  root: 'chrome-extension',
  publicDir: 'public',
  build: {
    outDir: resolve(import.meta.dirname, 'dist-extension'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'chrome-extension/popup/index.html'),
        content: resolve(import.meta.dirname, 'chrome-extension/content/content.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'content' ? 'content/content.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
