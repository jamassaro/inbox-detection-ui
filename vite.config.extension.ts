import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { buildManifest } from './chrome-extension/manifest.ts';

// Chrome content scripts and (classic) service workers can't load ES-module
// chunks, so each is built as its own self-contained IIFE: `--mode content`
// then `--mode background` (see the build:extension script).
const WEB_ORIGIN = (
  process.env.VITE_EXTENSION_WEB_ORIGIN || 'https://inbox-detection.web.app'
).replace(/\/+$/, '');

const manifestPlugin = (): Plugin => ({
  name: 'emit-extension-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'manifest.json',
      source: JSON.stringify(buildManifest(WEB_ORIGIN), null, 2),
    });
  },
});

export default defineConfig(({ mode }) => {
  const isContent = mode !== 'background';
  const entry = isContent ? 'content/gmail.tsx' : 'background/service-worker.ts';

  return {
    plugins: [react(), ...(isContent ? [manifestPlugin()] : [])],
    root: 'chrome-extension',
    publicDir: isContent ? 'public' : false,
    // React reads process.env.NODE_ENV, which doesn't exist in an extension.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: resolve(import.meta.dirname, 'dist-extension'),
      emptyOutDir: isContent,
      cssCodeSplit: false,
      lib: {
        entry: resolve(import.meta.dirname, 'chrome-extension', entry),
        name: isContent ? 'InboxDetectiveContent' : 'InboxDetectiveBackground',
        formats: ['iife'],
        fileName: () => (isContent ? 'content/gmail.js' : 'background/service-worker.js'),
      },
    },
  };
});
