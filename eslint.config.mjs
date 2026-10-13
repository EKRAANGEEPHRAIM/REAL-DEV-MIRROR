// Config ESLint racine : fichiers hors apps/ et libs/.
// Chaque app (apps/api, apps/web) a sa propre config, qui peut réutiliser `baseConfig`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/generated/**',
      'apps/**',
      'libs/**',
    ],
  },
  ...baseConfig,
  {
    languageOptions: { globals: globals.node },
  },
);
