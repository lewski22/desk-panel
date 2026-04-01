import { defineConfig } from 'vite';
import react    from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Outlook Add-in wymaga HTTPS nawet na localhost
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port:  3004,
    https: true,
    host:  true,
  },
  build: {
    outDir:      'dist',
    sourcemap:   true,
  },
});
