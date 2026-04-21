/**
 * tests/e2e/end-user.spec.ts
 *
 * END_USER — moje rezerwacje, check-in web, brak zakładek admina.
 * Używa sesji user@demo-corp.pl.
 */
import { test, expect } from '@playwright/test';

const ADMIN_ONLY_ROUTES = [
  '/users',
  '/organizations',
  '/provisioning',
  '/reports',
];

test.describe('END_USER — podstawowy dostęp', () => {
  test('widzi dashboard po zalogowaniu', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('widzi moje rezerwacje', async ({ page }) => {
    await page.goto('/my-reservations');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('END_USER — brak dostępu do sekcji admina', () => {
  for (const route of ADMIN_ONLY_ROUTES) {
    test(`nie może wejść na ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(2_000);

      const url       = page.url();
      const redirected = !url.includes(route);
      const shows403  = await page.getByText(/403|forbidden|brak dostępu|nie masz uprawnień/i)
        .isVisible()
        .catch(() => false);

      expect(redirected || shows403).toBeTruthy();
    });
  }
});

test.describe('END_USER — moje rezerwacje i check-in', () => {
  test('lista rezerwacji ładuje się', async ({ page }) => {
    await page.goto('/my-reservations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    // Lista lub komunikat o braku rezerwacji
    const hasList  = await page.locator('table, [data-testid="reservation-list"]').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/brak rezerwacji|no reservations|empty/i).isVisible().catch(() => false);
    const hasItems = await page.locator('[data-testid="reservation-item"], .reservation-card').count() > 0;

    expect(hasList || hasEmpty || hasItems).toBeTruthy();
  });

  test('check-in web — endpoint nie zwraca 500', async ({ page }) => {
    // Tylko weryfikujemy że endpoint istnieje (błąd 400/404 jest OK dla losowego ID)
    const response = await page.request.post('/api/v1/checkins/web', {
      data: { deskId: 'nonexistent-desk-id' },
    });
    expect([400, 404, 422]).toContain(response.status());
  });

  test('nie widzi zakładek administracyjnych w nawigacji', async ({ page }) => {
    await page.goto('/dashboard');

    // Linki administracyjne nie powinny być w nawigacji
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const texts    = await navLinks.allTextContents();
    const joined   = texts.join(' ').toLowerCase();

    expect(joined).not.toMatch(/użytkownicy|users|organizacje|organizations|provisioning/);
  });
});
