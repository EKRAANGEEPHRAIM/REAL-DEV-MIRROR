import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
    // Une base Neon en veille peut mettre quelques secondes à répondre.
    testTimeout: 30_000,
    // Les beforeAll créent utilisateurs et données de départ : une douzaine d'appels.
    hookTimeout: 90_000,
    // Toutes les suites partagent la même base : au-delà de 4 en parallèle, les connexions
    // se font attendre et les suites échouent par intermittence.
    maxWorkers: 4,
  },
});
