/**
 * tests/e2e/auth.setup.ts
 *
 * Uruchamiany PRZED wszystkimi testami (project "setup").
 * Zapisuje sesje dla czterech ról do osobnych plików JSON.
 * Kolejne testy wczytują odpowiednią sesję bez ponownego logowania.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

async function login(page: any, email: string, password: string, outFile: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/hasło|password/i).fill(password);
  await page.getByRole('button', { name: /zaloguj|log in|sign in/i }).click();
  await page.waitForURL(/dashboard|home|\/$/, { timeout: 10_000 });
  await expect(page).not.toHaveURL(/login/);
  await page.context().storageState({ path: outFile });
}

const DIR = path.join(__dirname, '.auth');

setup('authenticate: STAFF', async ({ page }) => {
  await login(
    page,
    process.env.TEST_STAFF_EMAIL    ?? 'staff@demo-corp.pl',
    process.env.TEST_STAFF_PASSWORD ?? 'Staff1234!',
    path.join(DIR, 'staff.json'),
  );
});

setup('authenticate: OFFICE_ADMIN', async ({ page }) => {
  await login(
    page,
    process.env.TEST_OA_EMAIL    ?? 'admin@demo-corp.pl',
    process.env.TEST_OA_PASSWORD ?? 'Admin1234!',
    path.join(DIR, 'office_admin.json'),
  );
});

setup('authenticate: SUPER_ADMIN', async ({ page }) => {
  await login(
    page,
    process.env.TEST_SA_EMAIL    ?? 'superadmin@reserti.pl',
    process.env.TEST_SA_PASSWORD ?? 'Admin1234!',
    path.join(DIR, 'super_admin.json'),
  );
});

setup('authenticate: END_USER', async ({ page }) => {
  await login(
    page,
    process.env.TEST_EU_EMAIL    ?? 'user@demo-corp.pl',
    process.env.TEST_EU_PASSWORD ?? 'User1234!',
    path.join(DIR, 'end_user.json'),
  );
});
