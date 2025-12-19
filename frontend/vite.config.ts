import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    // Ensure React is properly transformed
    jsxRuntime: 'automatic'
  })],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5176
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Disable code splitting to ensure React loads before any code that uses it
        // This prevents the "Cannot read properties of undefined (reading 'useState')" error
        manualChunks: undefined,
        // Alternative: Keep React in main bundle, split other vendors
        // manualChunks: (id) => {
        //   // Don't split React - keep it in main bundle
        //   if (id.includes('node_modules')) {
        //     if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('react/jsx-runtime')) {
        //       return undefined; // Keep in main bundle
        //     }
        //     if (id.includes('wagmi') || id.includes('viem')) {
        //       return 'wagmi-vendor';
        //     }
        //     if (id.includes('@tanstack/react-query')) {
        //       return 'query-vendor';
        //     }
        //     if (id.includes('ethers')) {
        //       return 'ethers-vendor';
        //     }
        //     return 'vendor';
        //   }
        // }
      }
    },
    // Ensure proper module resolution
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    minify: 'esbuild',
    target: 'esnext'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  }
});

