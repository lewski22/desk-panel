/**
 * Vitest global setup — Sprint I1
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-i18next — zwraca klucz jako tłumaczenie (bez plików locale)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t:    (key: string, opts?: any) => {
      if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        return key + JSON.stringify(opts);
      }
      return key;
    },
    i18n: { language: 'pl', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate:     () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useParams:       () => ({}),
    NavLink: ({ to, children, className }: any) => {
      const cls = typeof className === 'function' ? className({ isActive: false }) : className;
      return <a href={to} className={cls}>{children}</a>;
    },
  };
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock appApi — żeby testy nie robiły real HTTP calls
vi.mock('../api/client', () => ({
  appApi: {
    locations:    { listAll: vi.fn(), issues: vi.fn(), attendance: vi.fn(), floorPlan: { get: vi.fn(), upload: vi.fn(), delete: vi.fn() }, extended: vi.fn(), occupancy: vi.fn() },
    desks:        { status: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), batchPositions: vi.fn() },
    reservations: { getMy: vi.fn().mockResolvedValue([]), list: vi.fn(), create: vi.fn(), cancel: vi.fn(), createRecurring: vi.fn() },
    checkins:     { manual: vi.fn(), checkout: vi.fn() },
    users:        { list: vi.fn() },
    resources:    { list: vi.fn(), create: vi.fn(), availability: vi.fn(), book: vi.fn() },
    bookings:     { cancel: vi.fn() },
    push:         { vapidKey: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
    owner:        { getOrgs: vi.fn(), updateOrg: vi.fn(), setModules: vi.fn() },
    inapp:        { list: vi.fn().mockResolvedValue([]), markRead: vi.fn(), markAllRead: vi.fn() },
  },
}));
