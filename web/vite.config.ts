import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const pb = process.env.BAUBLE_PB ?? 'http://127.0.0.1:8090';

export default defineConfig({
  plugins: [svelte()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1200 },
  server: {
    proxy: {
      '/api': { target: pb, changeOrigin: false },
      '/_': { target: pb, changeOrigin: false },
    },
  },
});
