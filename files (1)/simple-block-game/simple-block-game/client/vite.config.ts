import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const clientDir = fileURLToPath(new URL('.', import.meta.url));
const projectDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: clientDir,
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: {
    port: 5173,
    fs: { allow: [projectDir] }, // lets the client import ../shared
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } }, // dev only
  },
});
