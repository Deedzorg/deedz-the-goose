import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production',
    assetsDir: 'assets',
  },
}));
