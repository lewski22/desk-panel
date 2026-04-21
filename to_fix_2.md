# To Fix — Lista błędów #2

## UX / Nawigacja

1. **[USER] Mapa przed rezerwacjami** — Na widoku użytkownika w pierwszej kolejności powinna być widoczna mapa, a nie lista już wykonanych rezerwacji.

2. **[MOBILE] Mapa nie znika przy zmianie zakładki** — Na mobile przy przechodzeniu między salami / parkingami / biurkami mapa powinna znikać. Powinny to być 3 oddzielne mapy.

3. **[MAP] Popup biurka — pozycja** — Po kliknięciu na mapie w wybrane biurko okienko wyskakuje z boku strony zamiast tuż obok wybranego biurka.

4. **[MAP] Przycisk "Rezerwuj" na mapie nie działa** — Po kliknięciu w "Rezerwuj" na mapie nie wykonuje się żadna akcja.

5. **[REZERWACJE] Check-in nadal widoczny po check-inie** — Po utworzeniu rezerwacji w web i wykonaniu check-inu, w "Moje rezerwacje" nadal jest wyświetlana opcja check-in.

---

## Dashboard / Raporty

6. **[DASHBOARD] Nie pokazuje informacji mimo wykonanych check-inów** — Dashboard nie wyświetla danych (np. zajętości), mimo że były wykonane check-iny przez użytkowników.

7. **[DASHBOARD] Czytelność na telefonie (Super Admin)** — Dashboard Super Admina wymaga poprawy czytelności na urządzeniach mobilnych.

8. **[RAPORTY] Kolejność — pierwszy ma być Snapshot** — W sekcji raportów pierwszym widokiem powinien być Snapshot.

---

## Wygląd / Spójność

9. **[UI] Kolor statusu urządzeń — nieczytelny** — Aktualny niebieski kolor statusu urządzeń jest mało czytelny. Należy wybrać bardziej kontrastowe/czytelne kolory statusów.

10. **[UI] Mieszanie języków PL/EN** — W całej aplikacji nie należy mieszać polskich i angielskich wstawek — wybrać jeden język i stosować go konsekwentnie.

11. **[UI] Poprawa wyglądu ogólnego** — Nowe spójne ikony, lepiej dobrane kolory nawiązujące do logo.

---

## Biura / Piętra

12. **[BIURO] Obsługa biur wielopiętrowych** — Przy tworzeniu / edycji biura należy zaznaczyć liczbę pięter. Każde piętro powinno mieć możliwość wgrania osobnego planu piętra. Biurka z jednego piętra nie są widoczne na innym. Piętro jest definiowane na poziomie tworzenia biurka.

---

## Błędy logiki / Uprawnienia

13. **[SUPER ADMIN] Błąd — wybór innej firmy przy dodawaniu biura** — Super Admin przy dodawaniu biura ma opcję wybrania innej firmy — to błąd. Super Admin powinien móc dodawać biura tylko w ramach swojej firmy.

### Bezpieczeństwo — naprawione (2026-04-21)

13a. **[SECURITY] Privilege escalation — rezerwacja dla innego użytkownika** ✅ NAPRAWIONE
- Każdy zalogowany użytkownik (w tym END_USER) mógł wysłać `targetUserId` w POST `/reservations` i zarezerwować biurko dla dowolnej osoby.
- Naprawka: `reservations.service.ts` — dodano sprawdzenie roli aktora przed użyciem `targetUserId`; `reservations.controller.ts` — przekazuje `req.user.role` do serwisu.

13b. **[SECURITY] IDOR — tworzenie lokalizacji w obcej organizacji** ✅ NAPRAWIONE
- OFFICE_ADMIN mógł wysłać `organizationId` innej firmy w POST `/locations` i tworzyć lokalizacje poza swoją organizacją.
- Naprawka: `locations.controller.ts` — dla ról niższych niż SUPER_ADMIN/OWNER `organizationId` jest nadpisywane wartością z JWT.

---

## Integracje

14. **[M365] Dwustronna synchronizacja kalendarza sal** — Przy tworzeniu sali i połączeniu konta z Microsoft 365 kalendarz powinien integrować się dwustronnie między systemem a Microsoft. Jeśli zostanie użyty system rezerwacji sal — synchronizacja powinna być trójstronna.

---

## Rejestracja / Onboarding

15. **[REJESTRACJA] Zaplanowanie flow rejestracji** — Formularz rejestracyjny wymaga zaprojektowania i wdrożenia pełnego flow rejestracji.

---

## PWA / Dedykowana aplikacja

16. **[PWA] Biurka wracają do poprzedniego układu** — Na PWA po dodaniu planu, ustawieniu biurek i wyjściu biurka wracają do wcześniejszego ułożenia (brak zapisu stanu).

17. **[PWA] Dedykowany link / panel dla tabletów** — Dodać specjalny link / panel pod PWA, aby można było uruchomić go np. na tablecie lub zainstalować dedykowaną aplikację. Wymagana analiza najlepszego podejścia.

---

## Demo

18. **[DEMO] Instancja demo z hardkodowanymi danymi** — Przygotować instancję demo z samym UI i hardkodowanymi danymi (bez backendu).
