import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/**
 * Tests de bout en bout du front. L'API est simulée dans le navigateur (e2e/support/mock-api.ts) :
 * ces tests vérifient l'interface (mise en page, accessibilité), sans base de données.
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
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Build de production servi en statique : plus fidèle à Vercel et plus stable que ng serve.
  webServer: {
    command: `pnpm exec ng build && node e2e/support/serve-dist.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
