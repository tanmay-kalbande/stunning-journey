import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: 'VITE_', // Vite standard prefix for client-exposed env vars
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
