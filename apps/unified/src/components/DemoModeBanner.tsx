/**
 * DemoModeBanner — shown at top of app when VITE_DEMO_MODE=true
 * Sticky bar reminding user they are in demo mode with hardcoded data.
 */
export function DemoModeBanner() {
  if (import.meta.env.PROD && import.meta.env.VITE_DEMO_MODE === 'true') {
    console.error('[RESERTI] CRITICAL: VITE_DEMO_MODE=true in production build!');
  }
  return (
    <div className="sticky top-0 z-[999] bg-amber-400 text-amber-950 text-xs font-semibold
      flex items-center justify-center gap-2 py-1.5 px-4 select-none">
      <span>⚡</span>
      <span>Tryb demonstracyjny — dane są przykładowe i nie są zapisywane</span>
      <span className="hidden sm:inline text-amber-700">· Demo mode — sample data only</span>
    </div>
  );
}
