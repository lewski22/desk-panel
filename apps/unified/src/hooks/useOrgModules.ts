/**
 * useOrgModules — sprawdza które moduły są aktywne dla zalogowanej org
 *
 * Semantyka: pusta tablica enabledModules = WSZYSTKIE moduły aktywne (backward compat).
 * Gdy Owner ustawi konkretne moduły, tylko one są dostępne.
 *
 * Moduły: DESKS | ROOMS | PARKING | FLOOR_PLAN | WEEKLY_VIEW
 */
import { useMemo } from 'react';
import { useOrgUser } from '../context/UserContext';

export type AppModule = 'DESKS' | 'ROOMS' | 'PARKING' | 'FLOOR_PLAN' | 'WEEKLY_VIEW' | 'EQUIPMENT' | 'BEACONS';

/**
 * Odczytuje enabledModules z UserContext (profil zalogowanego użytkownika).
 * Fallback: OWNER widzi wszystko zawsze.
 */
export function useOrgModules() {
  const user = useOrgUser();
  return useMemo(() => {
    if (!user) return { isEnabled: () => true, enabledModules: [] as string[] };

    if (user.role === 'OWNER') {
      return { isEnabled: (_: AppModule) => true, enabledModules: [] as string[] };
    }

    const modules: string[] = user.enabledModules ?? [];

    if (modules.length === 0) {
      return { isEnabled: (_: AppModule) => true, enabledModules: modules };
    }

    return {
      isEnabled:      (m: AppModule) => modules.includes(m),
      enabledModules: modules,
    };
  }, [user]);
}
