/**
 * tests/e2e/staff-rbac.spec.ts
 *
 * STAFF — weryfikacja że rol STAFF nie ma dostępu do sekcji administracyjnych.
 * Używa sesji staff@demo-corp.pl.
 */
import { test, expect } from '@playwright/test';

const ADMIN_ROUTES = [
  '/organizations',
  '/provisioning',
  '/users',
];

test.describe('STAFF — brak dostępu do paneli admin', () => {
  for (const route of ADMIN_ROUTES) {
    test(`nie może wejść na ${route}`, async ({ page }) => {
      await page.goto(route);
      // Oczekujemy: redirect na /dashboard lub /login lub 403 page
      await page.waitForURL(url =>
        !url.pathname.startsWith(route) ||
        url.pathname === route, // akceptowalny jeśli strona pokazuje 403 w UI
        { timeout: 5_000 },
      ).catch(() => {});

      const url = page.url();
      const isRedirected = !url.includes(route);
      const shows403 = await page.getByText(/403|forbidden|brak dostępu|nie masz uprawnień/i)
        .isVisible()
        .catch(() => false);

      expect(isRedirected || shows403).toBeTruthy();
    });
  }

  test('widzi dashboard z KPI', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('widzi mapę biurek', async ({ page }) => {
    await page.goto('/map');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('widzi moje rezerwacje', async ({ page }) => {
    await page.goto('/my-reservations');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('nie widzi sekcji analitycznych admina w dashboardzie', async ({ page }) => {
    await page.goto('/dashboard');

    // Sekcja "Top biurka" i "Metody check-in" nie powinna być widoczna dla STAFF
    const topDesks = await page.getByText(/top biurka|top desks/i).isVisible().catch(() => false);
    const methods  = await page.getByText(/metody check-in|check-in methods/i).isVisible().catch(() => false);
    expect(topDesks).toBeFalsy();
    expect(methods).toBeFalsy();
  });
});
