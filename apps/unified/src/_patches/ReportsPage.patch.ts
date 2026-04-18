// ── PATCH: apps/unified/src/pages/ReportsPage.tsx ────────────────────────────
//
// 1. Dodaj import:
import { InsightsWidget } from '../components/insights/InsightsWidget';

// 2. Dodaj sekcję poniżej heatmapy (przed summary stats lub na końcu strony):
//
//    Po istniejącej sekcji heatmapy, dodaj:

/*
  {/* AI Insights — Sprint K2 *//*}
  <div style={{
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 12,
    padding: '20px 16px',
    marginTop: 20,
  }}>
    <InsightsWidget
      locationId={locationId || ''}  // ← pobierz z state/filter
      showRefresh={true}
    />
  </div>
*/

// ── Pełny blok do wklejenia po sekcji <!-- ── Summary stats ──────────── --> ──
// (albo po zamknięciu div heatmapy)
