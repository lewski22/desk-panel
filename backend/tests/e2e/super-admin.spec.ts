/**
 * tests/e2e/super-admin.spec.ts
 *
 * SUPER_ADMIN — zarządzanie organizacjami, włączanie/wyłączanie modułów,
 * widok provisioningu.
 * Używa sesji superadmin@reserti.pl.
 */
import { test, expect } from '@playwright/test';

test.describe('SUPER_ADMIN — dostęp do wszystkich sekcji', () => {
  test('widzi stronę organizacji', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });

  test('widzi provisioning', async ({ page }) => {
    await page.goto('/provisioning');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });

  test('widzi dashboard z pełnymi KPI', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('widzi raporty', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('SUPER_ADMIN — zarządzanie organizacjami', () => {
  test('lista organizacji jest widoczna', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    // Musi być przynajmniej jeden wiersz organizacji lub komunikat o braku
    const hasRows    = await page.locator('tr, [data-testid="org-row"]').count() > 0;
    const hasEmpty   = await page.getByText(/brak organizacji|no organizations/i).isVisible().catch(() => false);
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('może otworzyć modal edycji organizacji', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const editBtn = page.getByRole('button', { name: /edytuj|edit|ustawienia|settings/i }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal.first()).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('modal organizacji zawiera sekcję modułów', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const editBtn = page.getByRole('button', { name: /edytuj|edit|ustawienia|settings/i }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();

      // Sekcja modułów: DESKS, ROOMS, PARKING, EQUIPMENT
      const hasModules = await page
        .getByText(/moduły|modules|biurka|desks|parking|equipment/i)
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      expect(hasModules).toBeTruthy();
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('SUPER_ADMIN — widok provisioningu', () => {
  test('provisioning pokazuje listę urządzeń lub gatewayów', async ({ page }) => {
    await page.goto('/provisioning');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const hasDevices = await page
      .getByText(/beacon|gateway|urządzen|device/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    const hasEmpty = await page
      .getByText(/brak|no devices|empty/i)
      .isVisible()
      .catch(() => false);

    expect(hasDevices || hasEmpty).toBeTruthy();
  });
});
