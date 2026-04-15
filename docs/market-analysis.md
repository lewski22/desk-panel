# Analiza rynku — Reserti vs. Konkurencja

> Data: 2026-04-15 — Źródła: G2, Capterra, People Managing People, Archie Blog, YAROOMS 2026

---

## Pozycja rynkowa

Reserti zajmuje **unikalną pozycję** na rynku hot-desk booking SaaS:
jedyna platforma łącząca oprogramowanie z własnym hardware IoT (NFC + LED beacony ESP32).

```
                     SILNE SaaS
                          │
    TableAir ──────────── │ ──────────── Robin ● Deskbird
    (IoT, słabe SaaS)     │             (silny SaaS, brak IoT)
                          │
SILNE IoT ────────────────┼──────────────────────── SŁABE IoT
                          │
    Reserti ★             │             Archie ● Skedda
    (IoT + SaaS, rośnie)  │
                          │
                     SŁABE SaaS
```

---

## Analiza 6 konkurentów

### Deskbird
**Pozycja:** Microsoft-native Enterprise | **Cena:** $3.75–$4.75/user/mths

| Mocne strony | Słabości |
|---|---|
| Natywna integracja Teams/Outlook | Brak IoT beaconów (NFC/LED) |
| Interaktywny plan piętra (drag & drop) | Cennik per-user — drogi przy dużym zespole |
| Hybrydowe planowanie tygodnia | Brak self-hosted |
| Booking sal + biurek w jednym | |
| Analytics Workforce z predykcją | |

**Wniosek:** Silny konkurent dla Enterprise M365. Brak IoT to nasza główna przewaga.

---

### Robin
**Pozycja:** Enterprise US | **Cena:** $29–$60/mths per space

| Mocne strony | Słabości |
|---|---|
| Najlepszy UX na rynku (3D floor plans) | Brak IoT/NFC |
| Integracja Zoom, Slack, Teams, Google | Drogi dla SMB |
| Visitor management | Skomplikowana konfiguracja |
| AI rekomendacje biurek (zapowiedź) | |
| Heatmapy i zaawansowane analytics | |

**Wniosek:** Wzorzec UX dla nas. Brak IoT = nasza nisza. AI desk recommendation — możemy wyprzedzić.

---

### Envoy Desks
**Pozycja:** Hybrid workplace suite | **Cena:** $4/user/mths (min $100)

| Mocne strony | Słabości |
|---|---|
| Visitor management (>100k sign-ins/dzień) | Desk booking to jeden z wielu modułów |
| Envoy Protect (health check-in) | Brak NFC/beacon hardware |
| Workspace utilization analytics | Cennik per-user |
| Slack/Teams/Calendar integracja | |

**Wniosek:** Dobry ekosystem, ale desk booking to dodatek. Brak hardware IoT.

---

### Archie
**Pozycja:** Per-desk pricing, SMB/Mid | **Cena:** ~$5–8/desk/mths

| Mocne strony | Słabości |
|---|---|
| Cennik per biurko (nie per user) | Brak IoT |
| Coworking + corporate w jednym | Brak NFC check-in |
| Bardzo dobry UX (4.9/5 G2) | Mniej integracji niż Robin/Envoy |
| Meeting rooms + parking | |

**Wniosek:** Zbliżony model cenowy do naszego Starter/Pro. Brak IoT to nasza przewaga.

---

### Skedda
**Pozycja:** Rule-heavy, Customizable | **Cena:** $99/mths flat

| Mocne strony | Słabości |
|---|---|
| Bardzo elastyczne reguły bookingów | UI przestarzały |
| Kalendarzowy widok (FullCalendar) | Brak IoT/NFC |
| SSO support | Nie dla enterprise |
| Online payments | Brak zaawansowanych analytics |

**Wniosek:** Dobry dla małych biur z prostymi potrzebami. Nasz UI jest lepszy. Brak IoT.

---

### TableAir
**Pozycja:** IoT-first, hardware+SaaS | **Cena:** Custom

| Mocne strony | Słabości |
|---|---|
| Sensory zajętości biurek (hardware) | Brak NFC check-in (karty) |
| Sit-stand desk control | Zamknięty hardware |
| LED display na biurku | Brak open-source gateway |
| Analytics z sensorów | Brak self-hosted |

**Wniosek:** Najbliższy nam pod kątem IoT. Ale: inny hardware, brak NFC, zamknięty ekosystem.
Nasza przewaga: NFC + open-source gateway (RPi) + ESP32.

---

## Luki produktowe (vs. rynek)

| Priorytet | Feature | Kto ma | Estymacja | Sprint |
|-----------|---------|--------|-----------|--------|
| 🔴 WYSOKI | Floor plan editor | Robin, Deskbird, Archie | 18 dni | D |
| 🔴 WYSOKI | UI Quick Wins (30+ usprawnień) | Best practices 2026 | 22 dni | A |
| 🔴 WYSOKI | Widok tygodniowy "kto kiedy w biurze" | Deskbird, Robin | 7 dni | E1 |
| 🟡 ŚREDNI | Sala konferencyjna + parking | Wszystkie wiodące | 8 dni | E2 |
| 🟡 ŚREDNI | CSV/XLSX export raportów | Robin, Envoy | 2 dni | C2 |
| 🟡 ŚREDNI | Slack bot integracja | Deskbird, Robin, Envoy | 3 dni | F2 |
| 🟡 ŚREDNI | Visitor management | Robin, Envoy | 8 dni | J |
| 🟡 ŚREDNI | Kiosk/tablet mode | Robin, Condeco | 3 dni | H3 |
| 🟢 NISKI | AI rekomendacje biurek | Robin (zapowiedź) | 5 dni | K1 |
| 🟢 NISKI | Publiczny booking (coworking) | Archie | 6 dni | L1 |
| 🟢 NISKI | Dark mode | Standard 2025 | 7 dni | P3 |
| 🟢 NISKI | Globalny Cmd+K search | Linear, Vercel | 8 dni | P3 |

---

## Analiza UI/UX — problemy vs. best practices 2025–2026

Benchmark: Robin, Deskbird, Linear, Vercel Dashboard, Stripe Dashboard.

### Dashboard (krytyczne)

| Problem | Stan | Fix | Sprint |
|---------|------|-----|--------|
| KPI cards bez trendu ↑↓ | Liczby bez kontekstu | Strzałka + % vs poprzedni tydzień | A1 |
| Desk grid zamiast actionable insights | Kolorowe kwadraty bez sensu | "Today's Issues" widget | A1 |
| Brak quick actions | 3+ kliknięcia do akcji | Quick action strip | A1 |
| Hourly heatmap nieczytelna mobile | Gęste etykiety | Co 2h / bary Rano/Południe/Wieczór | A1 |

### Mapa biurek (krytyczne)

| Problem | Stan | Fix | Sprint |
|---------|------|-----|--------|
| Brak wizualnego planu biura | Grid kart | SVG floor plan z drag & drop | D |
| ReservationModal 4+ kliknięcia | Długi flow | Inline quick-book popover | A2 |
| Nie widać kto gdzie siedzi | Tylko kolor statusu | Avatar inicjały (STAFF+) | A2 |
| Location picker — dropdown | Mały select | Tabs z live occupancy | A2 |

### Nawigacja i UX (średnie)

| Problem | Stan | Fix | Sprint |
|---------|------|-----|--------|
| Sidebar — flat lista | Brak hierarchii | Grupowanie z separatorami | A4 |
| Brak globalnego search | Osobne filtry per strona | Cmd+K palette | P3 |
| Brak breadcrumbs | Brak kontekstu org | Breadcrumb + org w headerze | A4 |
| Notyfikacje — flat lista | Brak kategorii | Tabs: IoT/Rezerwacje/System | A4 |
| Brak dark mode | Tylko light | CSS variables + toggle | P3 |
| Generyczne empty states | "Brak danych" | Kontekstowe z CTA | A4 |

### Mobile UX (wysokie)

| Problem | Stan | Fix | Sprint |
|---------|------|-----|--------|
| Brak bottom navigation | Hamburger sidebar | Bottom nav bar 4 ikony | H1 |
| Brak swipe gestures | Tylko przyciski | Swipe to cancel/mark | H2 |
| QR check-in — brak animacji sukcesu | Tekst | Checkmark animation + haptic | A4 |

### Tabele i listy (średnie)

| Problem | Stan | Fix | Sprint |
|---------|------|-----|--------|
| Brak sortowania kolumn | Fixed sort | Klikalne nagłówki + URL state | A3 |
| Brak bulk actions | Jedna po jednej | Checkbox + "Anuluj (5)" | A3 |
| Dropdown w provisioningu | Kliknij → otwórz | Hover-reveal icons | A3 |
| OTA status bez progressu | Badge "in_progress" | Progress bar z estymacją | A3 |

---

## Rekomendowana kolejność wdrożenia

Bazując na stosunku ROI (wartość/nakład):

```
TYDZIEŃ 1–2:   Sprint A (UI Quick Wins) — natychmiastowy efekt dla istniejących userów
TYDZIEŃ 3–4:   Sprint B (Subskrypcje) — revenue enabler
TYDZIEŃ 5:     Sprint C (Grafana + CSV) — potrzeby admina
TYDZIEŃ 6–12:  Sprint D (Floor Plan) — kluczowy feature rynkowy
TYDZIEŃ 13–15: Sprint E (Weekly View + Sala/Parking) — rozszerzenie rynku
TYDZIEŃ 16–18: Sprint F (Teams + Slack + Graph) — integracje
TYDZIEŃ 19–21: Sprint G+H (Recurring + Mobile) — kompletność
TYDZIEŃ 22–24: Sprint I (Testy) — jakość
Q4 2026:       Sprint J+K+L (Visitor + AI + Coworking) — nowe segmenty
Q1 2027:       P3 (Self-hosted + ISO 27001 + 1.0)
```

---

## Trendy rynkowe 2025–2026

1. **Cena per desk, nie per user** — Archie, Clearooms stosują model per desk. Nasz model (limity per plan) jest zbliżony. Rynek odchodzi od per-user.

2. **Konsolidacja z facility management** — Eptura (Condeco) kupowany przez firmy FM. Reserti może pozycjonować IoT jako przewagę w tej konsolidacji.

3. **AI workplace orchestration** — predykcja zajętości, rekomendacje biurek, automatyczne zarządzanie przestrzenią. Nasz plan K1 (proste rule-based AI) może wyprzedzić Robin.

4. **Return-to-office trend** — 80% firm ma mandaty RTO, ale 17% egzekwuje. Hot-desk software staje się infrastrukturą RTO. Rynek rośnie.

5. **Sensor-based occupancy** — TableAir, Freespace mają hardware sensory. Reserti ma NFC check-in jako alternatywę — równie dokładne, tańsze w konfiguracji.
