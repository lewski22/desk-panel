# Backlog — Reserti Desk Panel

> Ostatnia aktualizacja: 2026-04-28

Zestawienie wszystkich otwartych zadań (niezrealizowanych bugów, długu technicznego i planowanych funkcji).
Źródła: `roadmap.md`, `dev-log.md`.

---

## Tabela

| # | Obszar | Opis | Priorytet |
|---|--------|------|-----------|
| 1 | Security | Tokeny localStorage → httpOnly cookies — backend `Set-Cookie` + frontend auth flow. Patrz `docs/security-review.md` | Wysoki |
| 2 | Floor Plan | Floor Plan CDN (R2) — przechowywanie obrazów pięter w Cloudflare R2 zamiast lokalnie | Wysoki |
| 3 | Rezerwacje | Sprint L — Publiczny booking + Stripe Checkout (stripe.com API, checkout session) | Średni |
| 4 | Integracje | M365 calendar sync — dwustronna synchronizacja kalendarza sal konferencyjnych (rozszerzenie `GraphSyncModule`) | Średni |
| 5 | Visitor | Visitor email invite — wysyłka zaproszenia emailem (TODO w `visitors.service.ts`) | Średni |
| 6 | Tech debt | `as any` cleanup (136x) — generowanie typów z OpenAPI (`openapi-typescript`) | Średni |
| 7 | Testy | Playwright E2E testy — scenariusze golden path dla rezerwacji, check-in, admin | Średni |
| 8 | Dashboard | R1 pełny — `DashboardPage.tsx`: STAFF widzi KPI/wykresy (`isAtLeastStaff = isAdmin \|\| isStaff`) | Średni |
| 9 | UX | N-F9 wdrożenie — `useDirtyGuard` podpiąć w `EditLocationModal`, `EditUserModal`, `EditOrgModal` | Średni |
| 10 | Gateway | Gateway auto-setup.sh (Faza 1) — skrypt `@reboot` na Raspberry Pi odpytujący `/install/gateway/:token` | Niski |
| 11 | UI | Kiosk link w UI — przycisk/link otwierający KioskPage z poziomu panelu admina | Niski |
| 12 | Demo | Demo mode kompletne fixtures — `VITE_DEMO_MODE=true` istnieje, brakuje fixtures dla wszystkich stron | Niski |
| 13 | Hardware | R3 Beacon LED desync — analiza `beacons.service.ts` + retransmit stanu LED po heartbeat | Niski |
| 14 | Gateway | Cloud MQTT / Gateway SaaS (Faza 3) — beacony TLS → `mqtt.reserti.pl:8883`, brak lokalnego Pi | Niski |
| 15 | Compliance | ISO 27001 przygotowanie — audyt procesów, dokumentacja kontrolek | Niski |
| 16 | Security | Polityka haseł — rotacja co 365 dni (lub krócej per org), `mustChangePassword` flaga, OWNER wymusza globalny reset | Niski |

---

## Notatki do wybranych pozycji

### #1 — httpOnly cookies
Duży zakres zmian:
- Backend: middleware `Set-Cookie` (access + refresh), endpoint `POST /auth/refresh` jako cookie-only
- Frontend: usunięcie `localStorage` tokenów, axios interceptor oparty na cookies
- Dotyczy: `auth.controller.ts`, `client.ts`, `useAuth.ts`

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
