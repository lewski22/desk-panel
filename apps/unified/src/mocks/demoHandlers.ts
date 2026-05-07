/**
 * Demo mode request interceptor.
 * Returns mock data for known paths; returns undefined to fall through to real API.
 */
import {
  DEMO_USER, DEMO_LOCATIONS, DEMO_DESKS, DEMO_RESERVATIONS,
  DEMO_STATS, DEMO_ORG,
  DEMO_RESOURCES, DEMO_VISITORS,
  DEMO_REPORT_CHECKINS_BY_DAY, DEMO_REPORT_PER_DESK, DEMO_REPORT_PER_USER, DEMO_REPORT_METHODS,
} from './demoData';

type Handler = (path: string, method: string) => unknown;

const ROUTES: Array<{ test: RegExp | string; method?: string; handler: Handler }> = [
  // Auth
  { test: '/auth/me',    handler: () => DEMO_USER },
  { test: '/auth/login', method: 'POST', handler: () => ({
    accessToken: 'demo-token', refreshToken: 'demo-refresh', user: DEMO_USER,
  })},

  // Locations
  { test: '/locations/my', handler: () => DEMO_LOCATIONS },
  { test: '/locations',    handler: () => DEMO_LOCATIONS },

  // Desks
  { test: /\/locations\/[^/]+\/desks\/status/, handler: (_path) => {
    const locId = _path.split('/')[2];
    return { desks: DEMO_DESKS.filter(d => d.locationId === locId) };
  }},
  { test: /\/locations\/[^/]+\/desks$/, handler: (_path) => {
    const locId = _path.split('/')[2];
    return DEMO_DESKS.filter(d => d.locationId === locId);
  }},

  // Reservations
  { test: '/reservations/my', handler: () => DEMO_RESERVATIONS },
  { test: '/reservations',    handler: () => DEMO_RESERVATIONS },

  // Dashboard / reports
  { test: '/reports/snapshot', handler: () => DEMO_STATS },
  { test: '/reports/heatmap',  handler: () => ({ data: [], labels: [] }) },

  // Organizations / Owner
  { test: '/owner/organizations', handler: () => [DEMO_ORG] },
  { test: '/organizations',       handler: () => [DEMO_ORG] },
  { test: '/owner/stats',         handler: () => ({ orgs: 1, users: 3, desks: 15 }) },

  // Subscription
  { test: '/subscription/status', handler: () => ({ plan: 'enterprise', status: null }) },

  // Integrations, insights — empty stubs
  { test: '/integrations', handler: () => ({}) },
  { test: '/insights',     handler: () => ({ insights: [] }) },

  // Password policy — force reset stubs
  { test: /\/organizations\/[^/]+\/force-password-reset/, method: 'POST', handler: () => ({ affected: 3 }) },
  { test: /\/owner\/organizations\/[^/]+\/force-password-reset/, method: 'POST', handler: () => ({ affected: 3 }) },
  { test: '/owner/force-password-reset', method: 'POST', handler: () => ({ affected: 12 }) },

  // Resources per location
  { test: /\/locations\/[^/]+\/resources/, handler: (_path: string) => {
    const locId = _path.split('/')[2];
    return DEMO_RESOURCES.filter(r => r.locationId === locId);
  }},

  // Visitors per location
  { test: /\/locations\/[^/]+\/visitors/, handler: (_path: string) => {
    const locId = _path.split('/')[2];
    return DEMO_VISITORS.filter(v => v.locationId === locId);
  }},

  // Floor plan — brak w demo
  { test: /\/locations\/[^/]+\/floor-plan/, handler: () => null },

  // Reports szczegółowe
  { test: '/reports/checkins-by-day', handler: () => DEMO_REPORT_CHECKINS_BY_DAY },
  { test: '/reports/per-desk',        handler: () => DEMO_REPORT_PER_DESK },
  { test: '/reports/per-user',        handler: () => DEMO_REPORT_PER_USER },
  { test: '/reports/methods',         handler: () => DEMO_REPORT_METHODS },

  // Notifications SMTP — brak w demo
  { test: '/notifications/smtp', handler: () => ({ config: null, globalAvailable: false }) },

  // Provisioning / beacons — puste
  { test: /\/provisioning/, handler: () => [] },
  { test: /\/beacons/,      handler: () => [] },

  // Misc stubs
  { test: '/notifications/inapp/count', handler: () => ({ count: 0 }) },
  { test: '/notifications/inapp',       handler: () => [] },
  { test: /\/gateway/,                  handler: () => [] },
  { test: /\/devices/,                  handler: () => [] },
  { test: /\/users\/deactivated/,       handler: () => [] },
  { test: '/users',                     handler: () => [DEMO_USER] },
];

export function getDemoResponse(path: string, method: string): unknown {
  const stripped = path.split('?')[0];
  for (const route of ROUTES) {
    const matchMethod = !route.method || route.method === method;
    const matchPath   = typeof route.test === 'string'
      ? stripped === route.test || stripped.startsWith(route.test)
      : route.test.test(stripped);
    if (matchPath && matchMethod) {
      return route.handler(stripped, method);
    }
  }
  return undefined;
}
