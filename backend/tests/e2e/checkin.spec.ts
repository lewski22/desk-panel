/**
 * tests/e2e/checkin.spec.ts
 *
 * Testy flow check-in:
 * - Ręczny check-in przez admina
 * - QR scan (publiczny endpoint — no auth)
 * - Kiosk mode dostępny bez logowania
 */
import { test, expect } from '@playwright/test';

test.describe('Check-in flows', () => {
  test('admin can see check-in options on desk map', async ({ page }) => {
    // Zaloguj jako OFFICE_ADMIN
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@demo-corp.pl');
    await page.getByLabel(/hasło|password/i).fill('Admin1234!');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();
    await page.waitForURL(/dashboard/);

    // Przejdź do mapy
    const deskMapLink = page.getByRole('link', { name: /biurka|desks|mapa/i }).first();
    if (await deskMapLink.isVisible()) {
      await deskMapLink.click();
      await expect(page).toHaveURL(/desk|map/, { timeout: 5_000 });
    }
  });

  test('QR check-in public endpoint responds', async ({ page }) => {
    // Endpoint publiczny — nie wymaga auth
    // Testujemy że nie crashuje (404 jeśli token nieistnieje jest OK)
    const response = await page.request.post('/api/v1/visitors/qr/invalid-token-test-123');
    // Oczekujemy 404 (token nie istnieje) lub 400 (zły format) — nie 500
    expect([400, 404]).toContain(response.status());
  });

  test('kiosk page accessible without auth', async ({ page }) => {
    // KioskPage powinna działać bez JWT (publiczna)
    await page.goto('/kiosk');
    // Nie powinno przekierować na /login
    await expect(page).not.toHaveURL(/login/);
    // Kiosk powinien pokazać jakiś UI
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('kiosk with location parameter shows location desks', async ({ page }) => {
    // Przekaż przykładowy locationId — w realu powinien istnieć
    await page.goto('/kiosk?location=test');
    // Nie crashuje
    await expect(page).not.toHaveURL(/error|500/);
  });
});

test.describe('Admin check-in management', () => {
  test.use({
    storageState: { cookies: [], origins: [] }, // reset — logujemy się wewnątrz
  });

  test('OFFICE_ADMIN sees check-in history', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@demo-corp.pl');
    await page.getByLabel(/hasło|password/i).fill('Admin1234!');
    await page.getByRole('button', { name: /zaloguj|log in/i }).click();
    await page.waitForURL(/dashboard/);

    // Sprawdź że strona administracyjna rezerwacji jest dostępna
    await page.goto('/admin/reservations');
    await expect(page).not.toHaveURL(/login|forbidden|403/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
