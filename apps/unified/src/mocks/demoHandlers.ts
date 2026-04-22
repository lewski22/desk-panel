/**
 * Demo mode request interceptor.
 * Returns mock data for known paths; returns undefined to fall through to real API.
 */
import {
  DEMO_USER, DEMO_LOCATIONS, DEMO_DESKS, DEMO_RESERVATIONS,
  DEMO_STATS, DEMO_ORG,
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
