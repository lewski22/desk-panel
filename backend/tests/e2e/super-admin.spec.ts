/**
 * tests/e2e/super-admin.spec.ts
 *
 * SUPER_ADMIN — zarządzanie organizacjami, włączanie/wyłączanie
 * modułów, widok provisioningu, konfiguracja SSO.
 * Używa sesji superadmin@reserti.pl (zapisanej przez auth.setup.ts).
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

  test('widzi użytkowników', async ({ page }) => {
    await page.goto('/users');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('SUPER_ADMIN — zarządzanie organizacjami', () => {
  test('lista organizacji jest widoczna', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const hasRows  = await page.locator('tr, [data-testid="org-row"]').count() > 0;
    const hasCards = await page.locator('[class*="rounded-2xl"]').count() > 0;
    const hasEmpty = await page.getByText(/brak organizacji|no organizations/i)
      .isVisible().catch(() => false);
    expect(hasRows || hasCards || hasEmpty).toBeTruthy();
  });

  test('może otworzyć modal edycji lokalizacji', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const editBtn = page.getByRole('button', { name: /edytuj|edit/i }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal.first()).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('może otworzyć modal dodawania gateway (+ Gateway)', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const gwBtn = page.getByRole('button', { name: /gateway/i }).first();
    if (await gwBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gwBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal.first()).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('SUPER_ADMIN — provisioning beaconów', () => {
  test('strona provisioningu wyświetla listę urządzeń lub pusty stan', async ({ page }) => {
    await page.goto('/provisioning');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const hasContent = await page
      .locator('table tr, [data-testid="device-row"], [class*="beacon"], [class*="device"]')
      .or(page.getByText(/brak urządzeń|no devices|brak beaconów/i))
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('SUPER_ADMIN — RBAC', () => {
  test('nie ma dostępu do /owner (tylko OWNER)', async ({ page }) => {
    await page.goto('/owner');
    const url = page.url();
    const isRedirected = !url.includes('/owner') || url.includes('/dashboard');
    const shows403 = await page.getByText(/403|forbidden|brak dostępu/i)
      .isVisible().catch(() => false);
    expect(isRedirected || shows403).toBeTruthy();
  });

  test('może zmieniać hasło', async ({ page }) => {
    await page.goto('/change-password');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2, [class*="title"]').first())
      .toBeVisible({ timeout: 5_000 });
  });
});
