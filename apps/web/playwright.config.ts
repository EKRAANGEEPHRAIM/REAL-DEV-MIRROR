import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;
const API_PORT = 3100;
/** Parcours complet contre la vraie API (et sa base) : activé par E2E_API=1. */
const withApi = process.env['E2E_API'] === '1';

/**
 * Tests de bout en bout du front, sur le build de production servi en statique (plus fidèle à
 * Vercel et plus stable que ng serve) :
 * - audit : mise en page et accessibilité, API simulée dans le navigateur (e2e/support/mock-api.ts) ;
 * - parcours : inscription → projet → tâche → tableau de bord, contre l'API démarrée en local.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e-results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 4 : undefined,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'audit', testMatch: 'audit.spec.ts' },
    { name: 'parcours', testMatch: 'parcours.spec.ts' },
  ],
  webServer: [
    {
      command: 'pnpm exec ng build && node e2e/support/serve-dist.mjs',
      env: { PORT: String(PORT), API_PROXY: `http://localhost:${API_PORT}` },
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 300_000,
    },
    ...(withApi
      ? [
          {
            // DATABASE_URL et JWT_ACCESS_SECRET : variables de la CI, ou apps/api/.env en local.
            command: 'pnpm run build && node dist/main',
            cwd: '../api',
            env: {
              NODE_ENV: 'test',
              PORT: String(API_PORT),
              APP_URL: `http://localhost:${PORT}`,
              CORS_ORIGIN: `http://localhost:${PORT}`,
              RATE_LIMIT_ENABLED: 'false',
              // Emails écrits dans les logs, jamais envoyés (même si apps/api/.env a une clé).
              RESEND_API_KEY: '',
            },
            url: `http://localhost:${API_PORT}/api/v1/health`,
            reuseExistingServer: !process.env['CI'],
            timeout: 300_000,
          },
        ]
      : []),
  ],
});
