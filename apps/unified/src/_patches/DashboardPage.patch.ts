// ── PATCH: apps/unified/src/pages/DashboardPage.tsx ──────────────────────────
//
// DashboardPage ma już placeholder:
//   {ext?.insights && <InsightsWidget insights={ext.insights} />}
//
// Sprint K zmienia to na aktywne ładowanie przez API.
//
// 1. Dodaj import:
import { InsightsWidget } from '../components/insights/InsightsWidget';

// 2. Zastąp placeholder slot faktycznym komponentem.
//    Znajdź linię z "InsightsWidget" lub komentarzem K2 i podmień na:

// ── Wklej w JSX po sekcji "Today's Issues" lub "Hourly heatmap" ─────────────

/*
  {/* AI Insights — K2 *//*}
  <div className="mt-4">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-semibold text-zinc-700">
        {t('recommendations.insights_title', 'Insights AI')}
      </p>
      <a
        href="/reports#insights"
        className="text-xs text-[#B53578] hover:underline"
      >
        {t('recommendations.see_all', 'Zobacz wszystkie →')}
      </a>
    </div>
    <InsightsWidget
      locationId={locationId}
      compact={true}
    />
  </div>
*/

// ── i18n klucze do dodania w locales/pl/translation.json ─────────────────────
/*
  "recommendations": {
    "insights_title": "Insights AI",
    "see_all": "Zobacz wszystkie →",
    "banner_suggested": "Sugerowane",
    "banner_reserve": "+ Zarezerwuj",
    "banner_dismiss": "Nie teraz",
    "reason_favorite": "Twoje ulubione biurko",
    "reason_zone": "Ulubiona strefa",
    "reason_free": "Wolne biurko",
    "booked_times": "{{count}}× zarezerwowane",
    "no_data": "Za mało danych do insightów",
    "loading": "Ładowanie insightów...",
    "refresh": "↻ Odśwież",
    "refreshing": "...",
    "period": "Ostatnie 30 dni"
  }
*/

// ── i18n klucze w locales/en/translation.json ─────────────────────────────────
/*
  "recommendations": {
    "insights_title": "AI Insights",
    "see_all": "See all →",
    "banner_suggested": "Suggested",
    "banner_reserve": "+ Reserve",
    "banner_dismiss": "Not now",
    "reason_favorite": "Your favorite desk",
    "reason_zone": "Your preferred zone",
    "reason_free": "Available desk",
    "booked_times": "booked {{count}}×",
    "no_data": "Not enough data for insights",
    "loading": "Loading insights...",
    "refresh": "↻ Refresh",
    "refreshing": "...",
    "period": "Last 30 days"
  }
*/
