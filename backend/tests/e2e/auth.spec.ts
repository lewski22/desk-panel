/**
 * tests/e2e/auth.spec.ts
 *
 * Testy flow logowania i wylogowania.
 * Nie używa zapisanej sesji (storageState: undefined w konfiguracji projektu "setup").
 */
import { test, expect } from '@playwright/test';

// Nadpisz storageState dla tego pliku — testujemy nieautoryzowany dostęp
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('staff@demo-corp.pl');
    await page.getByLabel(/hasło|password/i).fill('Staff1234!');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();

    await page.waitForURL(/dashboard/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/login/);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('nobody@invalid.com');
    await page.getByLabel(/hasło|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();

    // Nie przekierowuje na dashboard
    await expect(page).toHaveURL(/login/);
    // Pokazuje komunikat błędu
    await expect(page.getByRole('alert').or(page.locator('[data-testid="error"]'))).toBeVisible({ timeout: 5_000 });
  });

  test('SUPER_ADMIN can login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('superadmin@reserti.pl');
    await page.getByLabel(/hasło|password/i).fill('Admin1234!');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();

    await page.waitForURL(/dashboard/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/login/);
  });

  test('logout redirects to login', async ({ page }) => {
    // Zaloguj się
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('staff@demo-corp.pl');
    await page.getByLabel(/hasło|password/i).fill('Staff1234!');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();
    await page.waitForURL(/dashboard/);

    // Wyloguj
    const logoutBtn = page.getByRole('button', { name: /wyloguj|log out|logout/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Szukaj w menu użytkownika
      await page.getByRole('button', { name: /menu|profil|avatar/i }).click();
      await page.getByRole('menuitem', { name: /wyloguj|logout/i }).click();
    }

    await page.waitForURL(/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/login/);
  });
});
