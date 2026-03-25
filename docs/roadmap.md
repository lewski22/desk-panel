# Roadmap — Reserti Desk Management System

## Aktualny stan (v1.0)

✅ Firmware ESP32 (NFC + LED + offline queue)  
✅ Gateway per-biuro (MQTT bridge + SQLite cache)  
✅ Backend NestJS (REST API + MQTT + PostgreSQL)  
✅ Panel Admin (biurka, użytkownicy, provisioning, raporty)  
✅ Panel Staff (mapa zajętości)  
✅ Deploy: Proxmox LXC + Coolify + Cloudflare Tunnel  

---

## Planowane — P2

### Panel OWNER (nowy poziom uprawnień)

Obecnie najwyższą rolą jest `SUPER_ADMIN` zarządzający platformą.  
Planowany poziom **OWNER** będzie zarządzał firmami (organizacjami) — to tenant root.

**Zakres panelu Owner:**
- Tworzenie i zarządzanie firmami (tenantami)
- Przypisywanie Super Adminów do firm
- Podgląd statystyk wszystkich firm
- Zarządzanie planami (starter / pro / enterprise)
- Billing i rozliczenia

**Otwarte pytania do analizy:**

#### A. Izolacja środowisk — oddzielny backend per firma vs współdzielony

| | Oddzielne backend per firma | Współdzielony backend |
|---|---|---|
| Izolacja danych | Pełna (osobna baza) | Row-level security |
| Koszt | Wyższy (wiele instancji) | Niższy |
| Wdrożenie | Złożone (Coolify multi-project) | Prostsze |
| Skalowanie | Niezależne per firma | Wspólna pula zasobów |
| Migracje | Niezależne | Jeden deployment |
| Compliance (GDPR) | Łatwiejsze | Wymaga dokładnego RLS |

**Rekomendacja:** Współdzielony backend z RLS (`organizationId` na każdej tabeli) dla < 50 firm. Powyżej — rozważyć sharding per firma.

#### B. Połączenie panelu Admin + Staff

Obecnie: dwie oddzielne aplikacje React pod różnymi domenami.

**Opcja 1: Jeden panel z routingiem per rola**
```
https://app.reserti.pl/
  → logowanie → wykrycie roli → redirect do odpowiedniego widoku
  SUPER_ADMIN / OFFICE_ADMIN → /admin/*
  STAFF                      → /staff/*
  END_USER                   → /user/* (nowy)
```
Zalety: jeden codebase, jedna domena, spójny login flow  
Wady: większy bundle, wymaga refactoru obu aplikacji

**Opcja 2: Zachowanie oddzielnych aplikacji + SSO**
```
https://admin.reserti.pl  → Admin Panel
https://staff.reserti.pl  → Staff Panel
https://app.reserti.pl    → PWA mobilna (nowa)
```
Zalety: mniejsze bundle, niezależny deploy  
Wady: duplikacja kodu (auth, komponenty), dwa URL-e do pamiętania

**Rekomendacja:** Opcja 1 — jeden panel z lazy-loaded modułami per rola. Frontend pod jedną domeną.

---

## Planowane — P3

### PWA mobilna (End User)

- Tworzenie i anulowanie rezerwacji
- QR check-in (aparat telefonu)
- Podgląd dostępności biurek w czasie rzeczywistym
- Push notyfikacje (via `user/{userId}/event` MQTT → WebSocket → PWA)
- Instalacja jako aplikacja na telefon (service worker)

### OTA aktualizacje firmware

- Serwer OTA: endpoint `GET /firmware/latest` + `GET /firmware/:version/binary`
- Beacon sprawdza wersję przy każdym heartbeat
- Automatyczne pobranie i wgranie przez ESP HTTP OTA
- Rollback po nieudanej aktualizacji

### NFC — wyższy poziom bezpieczeństwa

Aktualnie: UID karty (łatwy do skopiowania)  
Planowane: NDEF challenge-response lub MIFARE DESFire AES

### Monitoring i alerty

- Dashboard Grafana/Prometheus dla metryk gateway
- Alert gdy beacon offline > N minut
- Alert gdy gateway offline
- Weekly raport emailowy do Office Admin

### Integracje

- **Microsoft Entra ID (Azure AD)** — SSO dla użytkowników korporacyjnych
- **Google Workspace** — SSO + import users
- **Slack** — powiadomienia o rezerwacjach i check-inach
- **Webhook API** — zewnętrzne systemy mogą subskrybować eventy

---

## Planowane — P4

### Multi-region

Dla klientów z biurami w różnych krajach:
- Gateway w każdym kraju łączy się z regionalnym MQTT
- Dane rezerwacji replikowane między regionami
- GDPR compliance — dane UE nie opuszczają UE

### Zaawansowana analityka

- Heatmapy zajętości per strefa/piętro
- Predykcja popytu (ML na historii rezerwacji)
- Rekomendacje optymalnego rozmieszczenia biurek
- Eksport raportów do Excel/PDF

### Hardware v2

- Wyświetlacz E-ink (imię rezerwującego + godziny)
- Przycisk fizyczny (check-in bez NFC)
- PoE zamiast USB-C (jedno okablowanie)
- Szyfrowanie NFC (MIFARE DESFire)
