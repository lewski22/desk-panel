/**
 * @file brand.tokens.ts
 * @description Jedyne źródło prawdy dla design tokenów Reserti.
 *
 * JAK ZMIENIAĆ KOLORY / TYPOGRAFIĘ:
 *  1. Edytuj wartości w tym pliku.
 *  2. Uruchom: npm run tokens
 *  3. Zcommituj wszystkie zmienione pliki razem.
 *
 * NIE edytuj ręcznie:
 *  - apps/unified/tailwind.config.js     (generowany)
 *  - apps/unified/src/index.css          (generowany)
 *  - docs/DESIGN_TOKENS.md              (generowany)
 */

export const BRAND = {
  /** Główny kolor brand — używany wszędzie w content area */
  primary:      '#B53578',
  /** Ciemniejszy — hover state, sidebar active background */
  hover:        '#9C2264',
  /** Bardzo jasny — tło aktywnych chipów, fokus ring */
  surface:      '#FDF4F9',
  /** Jeszcze jaśniejszy — hover tło nieaktywnych elementów */
  surfaceHover: '#F8F6FC',
} as const;

export const BORDER = {
  /** Domyślna krawędź — inputy, karty */
  default: '#DCD6EA',
  /** Subtelna krawędź — nagłówki sekcji, linie tabeli */
  subtle:  '#EDE8FA',
  /** Najsubtelniejsza — separatory wewnętrzne */
  faint:   '#F0EDFA',
} as const;

export const INK = {
  /** Kolor tekstu głównego */
  primary:   '#1A0A2E',
  /** Kolor tekstu drugorzędowego (etykiety, opisy) */
  secondary: '#4A3F6B',
  /** Kolor tekstu pomocniczego (placeholder, meta) */
  muted:     '#6B5F7A',
  /** Kolor tekstu wyblakłego (disabled, nagłówki tabel) */
  faint:     '#A898B8',
} as const;

export const STATUS = {
  free:    '#10B981',   // emerald — wolne biurko
  pending: '#F59E0B',   // amber   — zarezerwowane
  occ:     '#EF4444',   // red     — zajęte / błąd
  offline: '#71717A',   // zinc    — offline / nieaktywne
  info:    '#1D4ED8',   // blue    — publiczne, informacja
} as const;

export const STATUS_BG = {
  free:    '#DCFCE7',
  pending: '#FEF3C7',
  occ:     '#FEF2F2',
  offline: '#F4F4F5',
  info:    '#EFF6FF',
} as const;

export const STATUS_TEXT = {
  free:    '#166534',
  pending: '#92400E',
  occ:     '#B91C1C',
  offline: '#71717A',
  info:    '#1D4ED8',
} as const;

export const FONT = {
  display: 'Sora',
  body:    'DM Sans',
} as const;

export const RADIUS = {
  /** Przyciski, chipy, inputy */
  md: '0.5rem',    // 8px
  /** Karty, dropdowny */
  lg: '0.75rem',   // 12px
  /** Modale, panele */
  xl: '1rem',      // 16px
} as const;

export const ICON_SIZE = {
  /** Ikony w przyciskach akcji (w-7 h-7) */
  sm: 14,
  /** Ikony w nagłówkach sekcji */
  md: 16,
  /** Ikony w EmptyState */
  xl: 36,
} as const;

export const ANIMATIONS = {
  fadeUp: {
    '0%':   { opacity: '0', transform: 'translateY(6px)' },
    '100%': { opacity: '1', transform: 'translateY(0)'   },
  },
  float: {
    '0%, 100%': { transform: 'translateY(0)'    },
    '50%':      { transform: 'translateY(-6px)' },
  },
  blink: {
    '0%, 100%': { opacity: '1' },
    '50%':      { opacity: '0' },
  },
  statusCycle: {
    '0%':   { background: STATUS.free    },
    '33%':  { background: STATUS.pending },
    '66%':  { background: STATUS.occ     },
    '100%': { background: STATUS.free    },
  },
  ringOut: {
    '0%':   { transform: 'scale(1)',   opacity: '0.6' },
    '100%': { transform: 'scale(1.8)', opacity: '0'   },
  },
} as const;

// ── Derived: tokeny gotowe do wklejenia do Tailwind ──────────────────
export const TAILWIND_COLORS = {
  brand: {
    DEFAULT:         BRAND.primary,
    hover:           BRAND.hover,
    surface:         BRAND.surface,
    'surface-hover': BRAND.surfaceHover,
  },
  ink: {
    DEFAULT:   INK.primary,
    secondary: INK.secondary,
    muted:     INK.muted,
    faint:     INK.faint,
  },
  border: {
    DEFAULT: BORDER.default,
    subtle:  BORDER.subtle,
    faint:   BORDER.faint,
  },
  status: {
    free:    STATUS.free,
    pending: STATUS.pending,
    occ:     STATUS.occ,
    offline: STATUS.offline,
    info:    STATUS.info,
  },
} as const;
