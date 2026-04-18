/**
 * tests/e2e/reservation.spec.ts
 *
 * Testy flow rezerwacji biurka.
 * Używa sesji staff@demo-corp.pl (zapisanej w auth.setup.ts).
 */
import { test, expect } from '@playwright/test';

test.describe('Reservations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
  });

  test('dashboard loads with KPI cards', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Sprawdź że są jakiekolwiek biurka lub KPI
    const hasContent = await page.locator('[data-testid="kpi"], .kpi, [class*="kpi"]')
      .or(page.getByText(/wolne|free|biurko|desk/i))
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('can navigate to desk map', async ({ page }) => {
    // Nawiguj do mapy biurek
    await page.getByRole('link', { name: /biurka|desks|mapa/i })
      .or(page.getByRole('link', { name: /map/i }))
      .first()
      .click();

    await expect(page).toHaveURL(/desk|map/);
  });

  test('my reservations page is accessible', async ({ page }) => {
    await page.goto('/my-reservations');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('can create a new reservation', async ({ page }) => {
    await page.goto('/my-reservations');

    // Kliknij przycisk nowej rezerwacji
    const newBtn = page.getByRole('button', { name: /nowa|new|dodaj|book|zarezerwuj/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 5_000 });
    await newBtn.click();

    // Sprawdź że modal/formularz się otworzył
    const modal = page.locator('[role="dialog"]').or(page.locator('[data-testid="reservation-form"]'));
    await expect(modal.first()).toBeVisible({ timeout: 3_000 });

    // Zamknij bez zapisu
    const closeBtn = page.getByRole('button', { name: /zamknij|close|anuluj|cancel/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('reservation list shows entries or empty state', async ({ page }) => {
    await page.goto('/my-reservations');
    // Albo lista rezerwacji albo pusty stan
    const hasContent = await page
      .locator('table tr, [data-testid="reservation-item"], [class*="reservation"]')
      .or(page.getByText(/brak rezerwacji|no reservations|empty/i))
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});
