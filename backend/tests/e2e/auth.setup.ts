/**
 * tests/e2e/auth.setup.ts
 *
 * Uruchamiany PRZED wszystkimi testami (project "setup").
 * Loguje użytkownika i zapisuje stan sesji do pliku.
 * Kolejne testy wczytują tę sesję bez ponownego logowania.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/staff.json');

setup('authenticate as staff', async ({ page }) => {
  await page.goto('/login');

  // Wypełnij formularz logowania
  await page.getByLabel(/email/i).fill(
    process.env.TEST_EMAIL ?? 'staff@demo-corp.pl',
  );
  await page.getByLabel(/hasło|password/i).fill(
    process.env.TEST_PASSWORD ?? 'Staff1234!',
  );
  await page.getByRole('button', { name: /zaloguj|log in|sign in/i }).click();

  // Poczekaj na redirect do dashboardu
  await page.waitForURL(/dashboard|home|\/$/, { timeout: 10_000 });

  // Weryfikacja: sprawdź że jesteśmy zalogowani
  await expect(page).not.toHaveURL(/login/);

  // Zapisz stan sesji (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE });
});
