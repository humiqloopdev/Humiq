import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // The interview checklist needs camera, microphone and screen capture on this origin.
  server: {
    port: 5174,
    strictPort: true,
    headers: { 'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self)' },
  },
  preview: {
    headers: { 'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self)' },
  },
});
