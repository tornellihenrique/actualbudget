import path from 'path';

import { defineConfig } from 'vite';

export default defineConfig({
  ssr: { external: ['@actual-app/api'] },
  build: {
    ssr: path.resolve(__dirname, 'src/index.ts'),
    target: 'node22',
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'index.js', format: 'es' },
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
