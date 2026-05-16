# Backlog — Reserti Desk Panel

> Ostatnia aktualizacja: 2026-05-16 (v0.21.0 — FREE TIER sprint)

Zestawienie wszystkich otwartych zadań (niezrealizowanych bugów, długu technicznego i planowanych funkcji).
Źródła: `roadmap.md`, `dev-log.md`.

---

## Tabela

| # | Obszar | Opis | Priorytet |
|---|--------|------|-----------|
| 1 | Security | ~~localStorage app_user → React Context~~ **✅ DONE v0.21.2** — UserContext, useOrgModules, DashboardPage, DeskMapPage, QrCheckinPage, ImpersonatePage, client.ts + BookingModal, ResourceCard, UsersPage, ReservationsPage, ParkingQrCheckinPage | ~~Średni~~ |
| 3 | Rezerwacje | Sprint L — Publiczny booking + Stripe Checkout (stripe.com API, checkout session) | Średni |
| 4 | Integracje | M365 calendar sync — dwustronna synchronizacja kalendarza sal konferencyjnych (rozszerzenie `GraphSyncModule`) | Średni |
| 6 | Tech debt | `as any` cleanup (136x) — generowanie typów z OpenAPI (`openapi-typescript`) | Średni |
| 7 | Testy | Playwright E2E testy — scenariusze golden path dla rezerwacji, check-in, admin | Średni |
| 9 | UX | useDirtyGuard podpiąć w EditLocationModal (OrganizationsPage.tsx). Pozostałe modale (EditOrgModal, UsersPage, DesksPage, ResourcesPage, VisitorsPage) mają już ochronę. | Niski |
| 10 | Gateway | ~~Gateway install.sh (Faza 1)~~ **✅ DONE v0.21.0** — `desk-gateway-python/install.sh` v1.1, systemd, Mosquitto ACL | ~~Niski~~ |
| 11 | UI | ~~Kiosk link w UI — przycisk/link otwierający KioskPage z poziomu panelu admina~~ **DONE v0.17.9** | ~~Niski~~ |
| 12 | Demo | ~~Demo mode kompletne fixtures — `VITE_DEMO_MODE=true` istnieje, brakuje fixtures dla wszystkich stron~~ **DONE v0.17.9** | ~~Niski~~ |
| 13 | Hardware | ~~R3 Beacon LED desync~~ **✅ DONE v0.21.0** — `mqtt.handlers.ts` wywołuje `restoreDeskLed()` przy `request_sync: true` | ~~Niski~~ |
| 14 | Gateway | Cloud MQTT / Gateway SaaS (Faza 3) — beacony TLS → `mqtt.reserti.pl:8883`, brak lokalnego Pi | Niski |
| 15 | Compliance | ISO 27001 przygotowanie — audyt procesów, dokumentacja kontrolek | Niski |
| 16 | Security | ~~Polityka haseł — rotacja co 365 dni (lub krócej per org), `mustChangePassword` flaga, OWNER wymusza globalny reset~~ **DONE v0.17.9** | ~~Niski~~ |
| 17 | Deploy | Floor Plan R2 — skonfigurować env vars w Coolify: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL. Kod gotowy w r2.service.ts. | Wysoki |
| 18 | Tech debt | M365 Calendar Sync — sale (Booking.graphEventId, webhook room mailbox) | Średni |
| 19 | Tech debt | OpenAPI-typescript — generowanie typów z Swagger | Niski |
| 20 | Deploy | Playwright CI secrets w GitHub (TEST_DATABASE_URL) | Niski |

---

## Notatki do wybranych pozycji

### #1 — localStorage user profile
Tokeny JWT są chronione (httpOnly cookies). Pozostał obiekt profilu użytkownika przechowywany jako JSON w localStorage pod kluczem `app_user`.

Dotyczy plików:
- `apps/unified/src/api/client.ts` — `login()` i `loginAzure()` robią `localStorage.setItem(KEYS.user, ...)`
- `apps/unified/src/hooks/useOrgModules.ts` — czyta `localStorage.getItem('app_user')`
- `apps/unified/src/pages/DashboardPage.tsx` — `useRole()` hook czyta localStorage
- `apps/unified/src/pages/DeskMapPage.tsx` — inline `JSON.parse(localStorage.getItem('app_user'))`

Rozwiązanie: endpoint `GET /auth/me` już istnieje — przechować profil w React Context zamiast localStorage. Impersonation token (`app_access`) zostawić w localStorage jako wyjątek.

### #3 — Sprint L (Stripe)
- Biurko/sala z flagą `isPublic: true` dostępne przez publiczny link
- Checkout session Stripe → webhook → `Reservation` z `paymentStatus`
- Nowy moduł: `PublicBookingModule`

### #4 — M365 calendar sync
- Rozszerzenie istniejącego `GraphSyncModule` o sale konferencyjne
- Dwukierunkowe: Outlook event → Resource booking + Resource booking → Outlook event
- Wymaga ustalenia scope `Calendars.ReadWrite` per room mailbox

### #10 — Gateway auto-setup.sh (Faza 1)
```bash
# cron @reboot na Raspberry Pi
curl -s https://api.reserti.pl/install/gateway/$TOKEN | bash
```
Token pobierany z QR kodu wygenerowanego w panelu (`POST /gateway/setup-tokens`).

### #17 — Floor Plan R2 deploy checklist
Kod w `r2.service.ts` jest gotowy. Wymagana konfiguracja w Coolify:

1. Utwórz bucket w Cloudflare R2 Dashboard
2. Wygeneruj API token z uprawnieniami do bucketu
3. Ustaw zmienne środowiskowe dla serwisu `desk-backend`:
```env
R2_ACCOUNT_ID=<Cloudflare Account ID>
R2_BUCKET_NAME=<nazwa bucketu>
R2_ACCESS_KEY_ID=<klucz dostępu>
R2_SECRET_ACCESS_KEY=<sekret>
R2_PUBLIC_URL=https://<bucket>.r2.dev  # lub własna domena
```
4. Zrestartuj backend — `R2Service` zaloguje `"R2 configured"`
