/**
 * apps/unified/src/components/organizations/KioskLinkButton.tsx
 *
 * Przycisk "Otwórz kiosk" dla każdej lokalizacji w OrganizationsPage.
 * Otwiera KioskPage w nowej karcie w trybie fullscreen z PIN z lokalizacji.
 *
 * Użycie:
 *   <KioskLinkButton locationId={loc.id} kioskPin={loc.kioskPin} />
 */
import { useTranslation } from 'react-i18next';

interface Props {
  locationId: string;
  kioskPin?:  string | null;
}

export function KioskLinkButton({ locationId, kioskPin }: Props) {
  const { t } = useTranslation();

  const handleOpen = () => {
    const params = new URLSearchParams({ location: locationId });
    if (kioskPin) params.set('pin', kioskPin);
    const url = `/kiosk?${params.toString()}`;
    window.open(url, '_blank', 'noopener');
  };

  return (
    <button
      onClick={handleOpen}
      title={t('kiosk.open_btn', 'Otwórz tryb kiosk (nowa karta)')}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
        text-xs font-medium border border-zinc-200 hover:border-zinc-300
        text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50
        transition-all duration-150"
    >
      <span className="text-[13px]">⬜</span>
      {t('kiosk.open_btn_short', 'Kiosk')}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: apps/unified/src/pages/OrganizationsPage.tsx
//
// 1. Import na górze pliku:
//    import { KioskLinkButton } from '../components/organizations/KioskLinkButton';
//
// 2. Znajdź miejsce gdzie renderowane są przyciski akcji per lokalizacja.
//    Dodaj <KioskLinkButton> obok istniejących przycisków (np. "Edytuj", "Floor Plan"):
//
//    Przykład — jeśli lokalizacje są w tabeli:
//    <td className="...">
//      {/* istniejące przyciski */}
//      <button onClick={() => ...}>Edytuj</button>
//      <button onClick={() => ...}>Plan piętra</button>
//
//      {/* DODAJ: */}
//      <KioskLinkButton locationId={loc.id} kioskPin={loc.kioskPin} />
//    </td>
//
//    Przykład — jeśli lokalizacje są w kartach:
//    <div className="flex gap-2">
//      {/* istniejące */}
//      <KioskLinkButton locationId={loc.id} kioskPin={loc.kioskPin} />
//    </div>
//
// 3. Upewnij się że loc.kioskPin jest w typie Location (może wymagać
//    aktualizacji zapytania API lub typu — kioskPin: string | null):
//
//    interface Location {
//      id:         string;
//      name:       string;
//      kioskPin?:  string | null;   // ← dodaj jeśli nie ma
//      // ...
//    }
//
// ─────────────────────────────────────────────────────────────────────────────
// i18n — dodaj klucze do locales/pl/translation.json i en/translation.json:
//
// pl:
//   "kiosk": {
//     ...istniejące klucze...,
//     "open_btn": "Otwórz tryb kiosk (nowa karta)",
//     "open_btn_short": "Kiosk"
//   }
//
// en:
//   "kiosk": {
//     ...existing...,
//     "open_btn": "Open kiosk mode (new tab)",
//     "open_btn_short": "Kiosk"
//   }
