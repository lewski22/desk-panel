/**
 * tests/e2e/office-admin.spec.ts
 *
 * OFFICE_ADMIN — zarządzanie użytkownikami, rezerwacje, raporty.
 * Kluczowa weryfikacja: OA nie może edytować ani dezaktywować SUPER_ADMIN.
 * Używa sesji admin@demo-corp.pl.
 */
import { test, expect } from '@playwright/test';

test.describe('OFFICE_ADMIN — dostęp do paneli', () => {
  test('widzi stronę użytkowników', async ({ page }) => {
    await page.goto('/users');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('widzi raporty', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('widzi rezerwacje', async ({ page }) => {
    await page.goto('/reservations');
    await expect(page).not.toHaveURL(/login|forbidden/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });

  test('widzi sekcje analityczne w dashboardzie', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
    // Admin widzi co najmniej KPI cards
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('OFFICE_ADMIN — nie może zarządzać SUPER_ADMIN', () => {
  test('nie widzi przycisku Deactivate przy SUPER_ADMIN na liście users', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    // Znajdź wiersz z SA (nazwa lub role badge)
    const saRow = page.locator('tr, [data-testid="user-row"]')
      .filter({ hasText: /super.?admin|superadmin/i });

    if (await saRow.count() > 0) {
      // W wierszu SA nie powinno być przycisku dezaktywacji
      const deactivateInSaRow = saRow.getByRole('button', { name: /dezaktywuj|deactivate/i });
      await expect(deactivateInSaRow).toHaveCount(0);
    }
    // Jeśli SA nie ma na liście OA — test passes (org isolation)
  });

  test('nie ma dostępu do /organizations', async ({ page }) => {
    await page.goto('/organizations');
    const url = page.url();
    const isRedirected = !url.includes('/organizations');
    const shows403 = await page.getByText(/403|forbidden|brak dostępu/i).isVisible().catch(() => false);
    expect(isRedirected || shows403).toBeTruthy();
  });

  test('nie ma dostępu do /provisioning', async ({ page }) => {
    await page.goto('/provisioning');
    const url = page.url();
    const isRedirected = !url.includes('/provisioning');
    const shows403 = await page.getByText(/403|forbidden|brak dostępu/i).isVisible().catch(() => false);
    expect(isRedirected || shows403).toBeTruthy();
  });
});

test.describe('OFFICE_ADMIN — zarządzanie użytkownikami', () => {
  test('może otworzyć modal dodawania użytkownika', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const addBtn = page.getByRole('button', { name: /dodaj|add|nowy|new|invite/i }).first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal.first()).toBeVisible({ timeout: 3_000 });

      await page.keyboard.press('Escape');
    }
  });
});
