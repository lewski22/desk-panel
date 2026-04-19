/**
 * teamsAuth.ts — Teams SSO flow
 *
 * Flow:
 *  1. app.initialize() — poinformuj Teams SDK że jesteśmy gotowi
 *  2. authentication.getAuthToken() — pobierz Azure AD token (SSO, silent)
 *  3. Wyślij token do /auth/azure → dostań Reserti JWT
 *  4. Zapisz JWT w sessionStorage (nie localStorage — bezpieczniejsze w Teams iframe)
 *
 * apps/teams/src/auth/teamsAuth.ts
 */
import * as microsoftTeams from '@microsoft/teams-js';

const API_BASE    = import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1';
const STORAGE_KEY = 'reserti_teams_jwt';

let _initPromise: Promise<void> | null = null;

/** Inicjalizuj Teams SDK (tylko raz) */
export async function initTeams(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = microsoftTeams.app.initialize();
  return _initPromise;
}

/** Sprawdź czy jesteśmy w środowisku Teams */
export function isTeamsContext(): boolean {
  try {
    return !!(window.parent !== window || (window as any).__teamsHost);
  } catch { return false; }
}

/** Pobierz token Azure AD od Teams (silent SSO) */
async function getAzureToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    microsoftTeams.authentication.getAuthToken({
      successCallback: resolve,
      failureCallback: (err) => reject(new Error(`Teams auth failed: ${err}`)),
    });
  });
}

/** Wymień token Azure na JWT Reserti */
async function exchangeForResertJwt(azureToken: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/auth/azure`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken: azureToken }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Auth failed' }));
    throw new Error(err.message ?? `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  // Backend /auth/azure zwraca { accessToken, refreshToken, user }
  return data.accessToken as string;
}

/** Zaloguj przez Teams SSO — zwraca Reserti JWT */
export async function loginViaTeams(): Promise<string> {
  await initTeams();

  // Sprawdź czy jest cached token
  const cached = sessionStorage.getItem(STORAGE_KEY);
  if (cached) return cached;

  const azureToken = await getAzureToken();
  const jwt        = await exchangeForResertJwt(azureToken);

  sessionStorage.setItem(STORAGE_KEY, jwt);
  return jwt;
}

/** Pobierz aktualny JWT (bez SSO flow) */
export function getStoredJwt(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Wyloguj — usuń token */
export function logout(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Odśwież token jeśli wygasł (wywołuj przy 401) */
export async function refreshJwt(): Promise<string> {
  sessionStorage.removeItem(STORAGE_KEY);
  return loginViaTeams();
}
