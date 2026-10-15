import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // Les décorateurs class-validator/class-transformer lisent les métadonnées de type
    setupFiles: ['reflect-metadata'],
    // Le module de test Nest peut dépasser 5 s quand l'API et le web sont testés en parallèle.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
