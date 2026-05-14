# Azure Entra ID (Microsoft 365) — Konfiguracja integracji

Instrukcja konfiguracji SSO przez Microsoft Entra ID dla organizacji w Reserti.

---

## Wymagania

- Dostęp do **Azure Portal** jako **Global Administrator** Entra ID
- Konto służbowe Microsoft 365 (konta osobiste @hotmail/@outlook nie są obsługiwane)
- Zmienna środowiskowa `VITE_AZURE_CLIENT_ID` ustawiona na frontendzie
- Zmienna `INTEGRATION_ENCRYPTION_KEY` ustawiona na backendzie (64-znakowy hex, AES-256)
- Zmienna `AZURE_CLIENT_ID` ustawiona na backendzie (do weryfikacji tokenów)

---

## Krok 1 — Rejestracja aplikacji w Azure Portal

1. Zaloguj się na [portal.azure.com](https://portal.azure.com) kontem **Global Admin**
2. Przejdź do **Microsoft Entra ID → App registrations → New registration**
3. Wypełnij:
   - **Name:** `Reserti`
   - **Supported account types:** `Accounts in any organizational directory (Any Azure AD directory - Multitenant)`
   - **Redirect URI:** zostaw puste na razie
4. Kliknij **Register**
5. Skopiuj **Application (client) ID** — to jest `AZURE_CLIENT_ID` / `VITE_AZURE_CLIENT_ID`

---

## Krok 2 — Redirect URI (typ SPA)

W zakładce **Authentication** dodaj redirect URI jako typ **Single-page application** (NIE Web):

```
https://app.twojadomena.pl/auth-redirect.html
```

> **Ważne:** Typ musi być **Single-Page Application**, nie Web. Błąd `AADSTS9002326` oznacza zły typ.

Kliknij **Save**.

---

## Krok 3 — Uprawnienia API

W zakładce **API permissions** dodaj:

| API | Uprawnienie | Typ |
|-----|-------------|-----|
| Microsoft Graph | `openid` | Delegated |
| Microsoft Graph | `profile` | Delegated |
| Microsoft Graph | `email` | Delegated |
| Microsoft Graph | `User.Read` | Delegated |

Kliknij **Grant admin consent for [Twoja org]**.

---

## Krok 4 — Zmienne środowiskowe

### Frontend (`apps/unified/.env`)
```
VITE_AZURE_CLIENT_ID=b50c9b4b-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Backend (`.env`)
```
AZURE_CLIENT_ID=b50c9b4b-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Klucz szyfrowania konfiguracji integracji (AES-256-GCM, 64 znaki hex)
# Generowanie: python3 -c "import secrets; print(secrets.token_hex(32))"
INTEGRATION_ENCRYPTION_KEY=twoj64znaklowykluczhex
```

---

## Krok 5 — Zgoda administratora dla organizacji klienta

Każda nowa organizacja klienta musi udzielić zgody administratora. Link do zgody jest dostępny w panelu:

**Ustawienia → Integracje → Azure Entra ID → Krok 1**

Format linku (generowany automatycznie przez aplikację):
```
https://login.microsoftonline.com/organizations/adminconsent
  ?client_id=<AZURE_CLIENT_ID>
  &redirect_uri=https%3A%2F%2Fapp.twojadomena.pl%2Fauth-redirect.html
  &prompt=login
```

Administrator klienta klika link, loguje się **służbowym** kontem M365 i klika **Akceptuj**.

> `&prompt=login` wymusza wpisanie danych — bez tego przeglądarka może automatycznie użyć zalogowanego konta osobistego.

---

## Krok 6 — Konfiguracja w panelu Reserti

Po udzieleniu zgody przez admina klienta:

1. Wejdź w **Ustawienia → Integracje → Azure Entra ID**
2. Krok 1: potwierdź że zgoda została udzielona
3. Krok 2: wpisz **Tenant ID** organizacji klienta
   - Znajdziesz go w Azure Portal → Entra ID → Overview → Tenant ID
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Opcjonalnie: wpisz dozwolone domeny email (np. `firma.com`)
4. Krok 3: włącz SSO
5. Krok 4: gotowe

---

## Znane błędy i rozwiązania

| Błąd | Przyczyna | Rozwiązanie |
|------|-----------|-------------|
| `AADSTS50011` — redirect URI mismatch | URI niezarejestrowany w Azure | Dodaj dokładny URI do App Registration → Authentication |
| `AADSTS9002326` — cross-origin token redemption | URI zarejestrowany jako Web zamiast SPA | Zmień typ na **Single-page application** |
| `hash_empty_error` (MSAL) | React Router czyści hash przed MSAL | `redirectUri` musi wskazywać na `/auth-redirect.html` (plik bez React Routera) |
| `You can't sign in here with a personal account` | Zalogowane konto osobiste w przeglądarce | `&prompt=login` wymusza wybór konta; użyj konta służbowego |
| `Logowanie przez Entra ID nie jest skonfigurowane` | Email nie istnieje w Reserti i domena nie pasuje do integracji | Dodaj domenę w polu "Dozwolone domeny email" w konfiguracji integracji |
| HTTP 500 przy zapisie integracji | Brak `INTEGRATION_ENCRYPTION_KEY` w `.env` | Wygeneruj klucz i ustaw w środowisku produkcyjnym, zrestartuj backend |

---

## Jak działa logowanie (JIT provisioning)

1. Użytkownik wpisuje służbowy email w oknie logowania
2. Backend szuka użytkownika po emailu lub domenie w aktywnych integracjach Azure
3. Frontend otwiera popup MSAL z `authority` ustawionym na Tenant ID organizacji
4. Microsoft weryfikuje konto i zwraca `id_token`
5. Backend weryfikuje podpis RS256 przez JWKS Microsoft
6. Jeśli użytkownik nie istnieje w Reserti — konto tworzone automatycznie z rolą `END_USER`
7. Istniejące konta z hasłem **nadal mogą się logować hasłem** — SSO nie blokuje logowania hasłem

---

## Bezpieczeństwo

- Konfiguracja integracji (Tenant ID, Client Secret) szyfrowana AES-256-GCM w bazie danych
- Tokeny MSAL przechowywane w `sessionStorage` (nie `localStorage`)
- `id_token` weryfikowany po stronie backendu przez JWKS Microsoft (nie po stronie frontendu)
- Użytkownicy JIT-provisioned przez SSO mają `passwordHash = 'AZURE_SSO_ONLY'` — nie mogą się logować hasłem
