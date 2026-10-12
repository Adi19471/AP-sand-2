import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Keep the heavy, rarely-changing libraries in their own chunks so the
        // app bundle stays small and cacheable on Firebase Hosting.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          pdf: ['jspdf', 'html2canvas'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
