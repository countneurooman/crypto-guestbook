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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Keep React and React-DOM together - this is critical
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('react/jsx-runtime')) {
              return 'react-vendor';
            }
            if (id.includes('wagmi') || id.includes('viem')) {
              return 'wagmi-vendor';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            if (id.includes('ethers')) {
              return 'ethers-vendor';
            }
            return 'vendor';
          }
        },
        // Ensure proper chunk loading order
        chunkFileNames: (chunkInfo) => {
          // React vendor should be loaded first
          if (chunkInfo.name === 'react-vendor') {
            return 'assets/react-vendor-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    },
    // Ensure proper module resolution
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // Increase minification to catch potential issues
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

