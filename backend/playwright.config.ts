/**
 * apps/unified/playwright.config.ts
 *
 * Konfiguracja Playwright E2E dla Reserti Unified Panel.
 *
 * Instalacja:
 *   cd apps/unified
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Uruchomienie:
 *   npx playwright test                  # wszystkie testy
 *   npx playwright test auth             # tylko auth.spec.ts
 *   npx playwright test --ui             # tryb interaktywny
 *   npx playwright test --headed         # z widoczną przeglądarką
 *
 * CI (GitHub Actions):
 *   npx playwright test --reporter=github
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3010';

export default defineConfig({
  testDir:  './tests/e2e',
  timeout:  30_000,
  retries:  process.env.CI ? 2 : 0,
  workers:  process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL:            BASE_URL,
    screenshot:         'only-on-failure',
    video:              'retain-on-failure',
    trace:              'retain-on-failure',
    // Zachowaj sesję między testami w tym samym projekcie
    storageState:       'tests/e2e/.auth/staff.json',
  },

  projects: [
    // ── Setup: login i zapisz sesję ──────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined }, // setup nie używa zapisanej sesji
    },

    // ── Testy wymagające zalogowania ──────────────────────────────
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // ── Mobile ───────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use:  { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command:            'npm run dev',
        url:                BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout:            30_000,
      },
});
