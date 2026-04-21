/**
 * backend/playwright.config.ts
 *
 * Konfiguracja Playwright E2E dla Reserti Unified Panel.
 * Osobne projekty per rola — każdy używa własnego pliku sesji.
 *
 * Uruchomienie:
 *   npx playwright test                         # wszystkie testy, wszystkie role
 *   npx playwright test --project=staff         # tylko testy roli STAFF
 *   npx playwright test staff-rbac              # konkretny plik
 *   npx playwright test --ui                    # tryb interaktywny
 *
 * CI:
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
    baseURL:   BASE_URL,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'retain-on-failure',
  },

  projects: [
    // ── Setup: zapisz sesje dla wszystkich ról ───────────────────
    {
      name:      'setup',
      testMatch: /auth\.setup\.ts/,
      use:       { storageState: undefined },
    },

    // ── STAFF ────────────────────────────────────────────────────
    {
      name: 'staff',
      testMatch: /\/(auth|reservation|checkin|staff-rbac)\.spec\.ts/,
      use:  {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/staff.json',
      },
      dependencies: ['setup'],
    },

    // ── OFFICE_ADMIN ─────────────────────────────────────────────
    {
      name: 'office-admin',
      testMatch: /\/office-admin\.spec\.ts/,
      use:  {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/office_admin.json',
      },
      dependencies: ['setup'],
    },

    // ── SUPER_ADMIN ──────────────────────────────────────────────
    {
      name: 'super-admin',
      testMatch: /\/super-admin\.spec\.ts/,
      use:  {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/super_admin.json',
      },
      dependencies: ['setup'],
    },

    // ── END_USER ─────────────────────────────────────────────────
    {
      name: 'end-user',
      testMatch: /\/end-user\.spec\.ts/,
      use:  {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/end_user.json',
      },
      dependencies: ['setup'],
    },

    // ── Public / no-auth ─────────────────────────────────────────
    {
      name: 'public',
      testMatch: /\/auth\.spec\.ts/,
      use:  {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },

    // ── Mobile (STAFF sesja) ─────────────────────────────────────
    {
      name: 'mobile-chrome',
      testMatch: /\/(auth|reservation|checkin)\.spec\.ts/,
      use:  {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/staff.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command:             'npm run dev',
        url:                 BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout:             30_000,
      },
});
