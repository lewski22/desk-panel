# Role użytkowników — Reserti Desk Management

## Przegląd ról

System ma 4 role. Każda osoba dodawana do systemu dostaje dokładnie jedną rolę.

| Rola | Identyfikator | Kto to jest |
|---|---|---|
| **Super Admin** | `SUPER_ADMIN` | Administrator całej platformy Reserti |
| **Office Admin** | `OFFICE_ADMIN` | Administrator konkretnego biura / firmy |
| **Staff** | `STAFF` | Pracownik recepcji / helpdesk biura |
| **Użytkownik** | `END_USER` | Zwykły pracownik firmy — korzysta z biurek |

---

## END_USER — zwykły pracownik

**To jest domyślna rola dla każdej osoby dodawanej do systemu.**

Pracownik firmy który przychodzi do biura i rezerwuje / zajmuje biurko.

### Co może:
- Zalogować się do Staff Panelu (`staff.domena.pl`)
- Skanować kod QR na biurku telefonem
- Zarezerwować wolne biurko przez QR (walk-in)
- Potwierdzić swoją rezerwację przez QR (check-in)
- Zwolnić swoje biurko przez QR (check-out)
- Przeglądać mapę zajętości biurek

### Czego nie może:
- Wchodzić do Admin Panelu
- Robić check-in na cudzym biurku
- Anulować cudzych rezerwacji
- Zarządzać urządzeniami, użytkownikami, biurkami

### Jak dodać użytkownika:
```
Admin Panel → Użytkownicy → + Nowy użytkownik
  Rola: Użytkownik  ← domyślna
```

---

## STAFF — pracownik recepcji / helpdesk

Osoba przy recepcji lub helpdesku biura. Ma wgląd w mapę i może ręcznie obsługiwać check-iny (np. gdy ktoś nie ma telefonu lub karta NFC nie działa).

### Co może (wszystko co END_USER, plus):
- Ręczny check-in dowolnego użytkownika przy dowolnym biurku
- Ręczny check-out dowolnego biurka
- Przeglądać listę wszystkich rezerwacji na dziś
- Przeglądać stan urządzeń (beaconów)

### Czego nie może:
- Wchodzić do Admin Panelu
- Zarządzać użytkownikami, biurkami, urządzeniami
- Dodawać/usuwać rezerwacji (tylko potwierdzać)

---

## OFFICE_ADMIN — administrator biura

Osoba odpowiedzialna za zarządzanie biurem w danej firmie. Ma pełny dostęp do Admin Panelu dla swojej organizacji.

### Co może:
- Pełny Admin Panel dla swojej organizacji
- Dodawać / edytować / dezaktywować biurka
- Dodawać / edytować / dezaktywować użytkowników
- Zmieniać role użytkowników (z wyjątkiem nadawania roli SUPER_ADMIN)
- Rejestrować i zarządzać gateway'ami i beaconami
- Generować kody QR dla biurek
- Przeglądać raporty i analitykę
- Anulować rezerwacje

### Czego nie może:
- Zarządzać innymi organizacjami
- Nadawać roli SUPER_ADMIN

---

## SUPER_ADMIN — administrator platformy

Operator platformy Reserti. Ma dostęp do wszystkich organizacji.

### Co może:
- Wszystko co OFFICE_ADMIN, dla **wszystkich** organizacji
- Zarządzać organizacjami (tworzenie, edycja, dezaktywacja)
- Nadawać rolę SUPER_ADMIN innym użytkownikom
- Przeglądać logi i zdarzenia systemowe wszystkich firm

---

## Podsumowanie uprawnień

| Akcja | END_USER | STAFF | OFFICE_ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| Logowanie do Staff Panel | ✅ | ✅ | ✅ | ✅ |
| Mapa zajętości biurek | ✅ | ✅ | ✅ | ✅ |
| Rezerwacja biurka (QR walk-in) | ✅ | ✅ | ✅ | ✅ |
| Check-in własny (QR / NFC) | ✅ | ✅ | ✅ | ✅ |
| Check-out własny | ✅ | ✅ | ✅ | ✅ |
| Ręczny check-in / check-out (cudzego) | ❌ | ✅ | ✅ | ✅ |
| Admin Panel | ❌ | ❌ | ✅ | ✅ |
| Zarządzanie biurkami | ❌ | ❌ | ✅ | ✅ |
| Zarządzanie użytkownikami | ❌ | ❌ | ✅ | ✅ |
| Provisioning beaconów | ❌ | ❌ | ✅ | ✅ |
| Raporty i analityka | ❌ | ❌ | ✅ | ✅ |
| Zarządzanie organizacjami | ❌ | ❌ | ❌ | ✅ |
| Nadawanie roli SUPER_ADMIN | ❌ | ❌ | ❌ | ✅ |

---

## Konta testowe (seed)

| Email | Hasło | Rola |
|---|---|---|
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |
| `user@demo-corp.pl` | `User1234!` | END_USER |

---

## Zmiana roli

Role można zmieniać w Admin Panelu → Użytkownicy → Edytuj.

**Ważne ograniczenie:** rolę `SUPER_ADMIN` może nadać **wyłącznie** inny Super Admin.
Office Admin może zmieniać role użytkowników między `END_USER`, `STAFF` i `OFFICE_ADMIN`.
