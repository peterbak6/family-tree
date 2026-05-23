import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'd3': ['d3']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
