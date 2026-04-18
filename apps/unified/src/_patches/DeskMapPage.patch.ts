// ── PATCH: apps/unified/src/pages/DeskMapPage.tsx ────────────────────────────
//
// 1. Dodaj import na górze pliku:
import { RecommendationBanner } from '../components/recommendations/RecommendationBanner';

// 2. Pobierz userId z JWT/localStorage (jeśli nie ma jeszcze):
//    const userId = useMemo(() => {
//      try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.id ?? ''; }
//      catch { return ''; }
//    }, []);

// 3. Pobierz dzisiejszą datę i domyślny slot:
//    const today = new Date().toISOString().slice(0, 10);

// 4. Obsłuż kliknięcie "Zarezerwuj" z banera:
//    const handleBannerReserve = useCallback((deskId: string) => {
//      // Otwórz ReservationModal z pre-wybranym deskId
//      setSelectedDeskId(deskId);
//      setModalOpen(true);
//    }, []);

// 5. Wklej banner NAD siatką biurek, PO filtrach/tabsach lokalizacji:
//    Miejsce: tuż przed renderowaniem <DeskMap> lub <FloorPlanView>

// ── Przykład użycia w JSX ────────────────────────────────────────────────────
/*
  <RecommendationBanner
    locationId={selectedLocationId}
    userId={userId}
    date={today}
    start="08:00"
    end="17:00"
    onReserve={handleBannerReserve}
  />

  {/* reszta mapy biurek *//*}
  <DeskMap desks={desks} ... />
*/

// ── Skrócony diff dla orientacji ─────────────────────────────────────────────
// PRZED:
//   return (
//     <div>
//       <LocationTabs ... />
//       <DeskMap desks={desks} ... />
//     </div>
//   );
//
// PO:
//   return (
//     <div>
//       <LocationTabs ... />
//       <RecommendationBanner     ← NOWE
//         locationId={selectedLocationId}
//         userId={userId}
//         date={today}
//         onReserve={handleBannerReserve}
//       />
//       <DeskMap desks={desks} ... />
//     </div>
//   );
