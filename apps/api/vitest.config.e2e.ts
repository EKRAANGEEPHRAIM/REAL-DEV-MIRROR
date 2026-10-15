import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['reflect-metadata'],
    // Une base Neon en veille peut mettre quelques secondes à répondre.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
