import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['crypto', 'stream', 'util', 'events', 'buffer', 'process'],
      globals: {
        Buffer: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      '@sdk': path.resolve(__dirname, '../solana-program/SDK'),
      os: 'os-browserify/browser',
      stream: 'stream-browserify',
      https: 'https-browserify',
      url: 'url',
      '@solana/web3.js': path.resolve(__dirname, './node_modules/@solana/web3.js'),
      '@coral-xyz/borsh': path.resolve(__dirname, './node_modules/@coral-xyz/borsh'),
      'bn.js': path.resolve(__dirname, './node_modules/bn.js'),
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(__dirname, './node_modules/vite-plugin-node-polyfills/shims/buffer'),
      'vite-plugin-node-polyfills/shims/process': path.resolve(__dirname, './node_modules/vite-plugin-node-polyfills/shims/process'),
    },
    dedupe: ['@solana/web3.js', '@coral-xyz/borsh', 'bn.js'],
  },
  define: {
    Buffer: 'globalThis.Buffer',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
