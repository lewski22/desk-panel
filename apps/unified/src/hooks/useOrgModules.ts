/**
 * useOrgModules — sprawdza które moduły są aktywne dla zalogowanej org
 *
 * Semantyka: pusta tablica enabledModules = WSZYSTKIE moduły aktywne (backward compat).
 * Gdy Owner ustawi konkretne moduły, tylko one są dostępne.
 *
 * Moduły: DESKS | ROOMS | PARKING | FLOOR_PLAN | WEEKLY_VIEW
 */
import { useMemo } from 'react';

export type AppModule = 'DESKS' | 'ROOMS' | 'PARKING' | 'FLOOR_PLAN' | 'WEEKLY_VIEW';

/**
 * Odczytuje enabledModules z danych zalogowanego użytkownika / org.
 * app_user w localStorage może mieć pole org.enabledModules wstrzyknięte
 * przy logowaniu lub przy impersonacji.
 *
 * Fallback: OWNER i SUPER_ADMIN widzą wszystko zawsze.
 */
export function useOrgModules() {
  return useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('app_user') ?? 'null');
      if (!user) return { isEnabled: () => true, enabledModules: [] as string[] };

      // OWNER i SUPER_ADMIN mają dostęp do wszystkiego
      if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') {
        return { isEnabled: (_: AppModule) => true, enabledModules: [] as string[] };
      }

      const modules: string[] = user.enabledModules ?? [];

      // Pusta tablica = wszystkie moduły aktywne (legacy / brak konfiguracji)
      if (modules.length === 0) {
        return { isEnabled: (_: AppModule) => true, enabledModules: modules };
      }

      return {
        isEnabled:      (m: AppModule) => modules.includes(m),
        enabledModules: modules,
      };
    } catch {
      return { isEnabled: () => true, enabledModules: [] as string[] };
    }
  }, []);
}
