/**
 * Skrypt generujący pliki config z brand.tokens.ts
 * Uruchom: npm run tokens (z katalogu głównego monorepo)
 *
 * Generuje:
 *  - apps/unified/tailwind.config.js
 *  - apps/unified/src/index.css
 *  - docs/DESIGN_TOKENS.md
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import {
  BRAND, BORDER, INK, STATUS, STATUS_BG, STATUS_TEXT,
  FONT, RADIUS, ICON_SIZE,
} from './brand.tokens';

// Always run from repo root via: npm run tokens
const ROOT = process.cwd();

function write(relPath: string, content: string): void {
  const abs = resolve(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  console.log(`  ✓  ${relPath}`);
}

// ── 1. tailwind.config.js ─────────────────────────────────────────────
const tailwindConfig = `\
/** @type {import('tailwindcss').Config} */
/**
 * ⚠️  PLIK GENEROWANY — nie edytuj ręcznie.
 *     Źródło: design/brand.tokens.ts
 *     Generator: npm run tokens
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT:         '${BRAND.primary}',
          hover:           '${BRAND.hover}',
          surface:         '${BRAND.surface}',
          'surface-hover': '${BRAND.surfaceHover}',
        },
        ink: {
          DEFAULT:   '${INK.primary}',
          secondary: '${INK.secondary}',
          muted:     '${INK.muted}',
          faint:     '${INK.faint}',
        },
        border: {
          DEFAULT: '${BORDER.default}',
          subtle:  '${BORDER.subtle}',
          faint:   '${BORDER.faint}',
        },
        status: {
          free:    '${STATUS.free}',
          pending: '${STATUS.pending}',
          occ:     '${STATUS.occ}',
          offline: '${STATUS.offline}',
          info:    '${STATUS.info}',
        },
      },
      fontFamily: {
        display: ['${FONT.display}', 'system-ui', 'sans-serif'],
        body:    ['${FONT.body}',    'system-ui', 'sans-serif'],
      },
      borderRadius: {
        md: '${RADIUS.md}',
        lg: '${RADIUS.lg}',
        xl: '${RADIUS.xl}',
      },
      minHeight: { touch: '2.75rem' },
      minWidth:  { touch: '2.75rem' },
      keyframes: {
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
          '0%':   { background: '${STATUS.free}'    },
          '33%':  { background: '${STATUS.pending}' },
          '66%':  { background: '${STATUS.occ}'     },
          '100%': { background: '${STATUS.free}'    },
        },
        ringOut: {
          '0%':   { transform: 'scale(1)',   opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0'   },
        },
      },
      animation: {
        fadeUp:      'fadeUp 0.2s ease-out',
        float:       'float 3s ease-in-out infinite',
        blink:       'blink 1s step-start infinite',
        statusCycle: 'statusCycle 3s infinite',
        ringOut:     'ringOut 1s ease-out infinite',
      },
    },
  },
  plugins: [],
};
`;

write('apps/unified/tailwind.config.js', tailwindConfig);

// ── 2. index.css ──────────────────────────────────────────────────────
const indexCss = `\
/* ⚠️  PLIK GENEROWANY — nie edytuj ręcznie.
 *     Źródło: design/brand.tokens.ts
 *     Generator: npm run tokens
 */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Brand */
  --brand:               ${BRAND.primary};
  --brand-hover:         ${BRAND.hover};
  --brand-surface:       ${BRAND.surface};
  --brand-surface-hover: ${BRAND.surfaceHover};

  /* Ink */
  --ink:           ${INK.primary};
  --ink-secondary: ${INK.secondary};
  --ink-muted:     ${INK.muted};
  --ink-faint:     ${INK.faint};

  /* Border */
  --border:        ${BORDER.default};
  --border-subtle: ${BORDER.subtle};
  --border-faint:  ${BORDER.faint};

  /* Status */
  --status-free:    ${STATUS.free};
  --status-pending: ${STATUS.pending};
  --status-occ:     ${STATUS.occ};
  --status-offline: ${STATUS.offline};
  --status-info:    ${STATUS.info};

  /* Status backgrounds */
  --status-free-bg:    ${STATUS_BG.free};
  --status-pending-bg: ${STATUS_BG.pending};
  --status-occ-bg:     ${STATUS_BG.occ};
  --status-offline-bg: ${STATUS_BG.offline};
  --status-info-bg:    ${STATUS_BG.info};

  /* Status text */
  --status-free-text:    ${STATUS_TEXT.free};
  --status-pending-text: ${STATUS_TEXT.pending};
  --status-occ-text:     ${STATUS_TEXT.occ};
  --status-offline-text: ${STATUS_TEXT.offline};
  --status-info-text:    ${STATUS_TEXT.info};

  /* Fonts */
  --font-display: '${FONT.display}', system-ui, sans-serif;
  --font-body:    '${FONT.body}',    system-ui, sans-serif;

  /* Radius */
  --radius-md: ${RADIUS.md};
  --radius-lg: ${RADIUS.lg};
  --radius-xl: ${RADIUS.xl};
}

@layer base {
  button, [role="button"], a, input, select, textarea {
    -webkit-tap-highlight-color: transparent;
  }
  button, [role="button"] {
    touch-action: manipulation;
  }
  ::selection {
    background-color: color-mix(in srgb, var(--brand) 15%, transparent);
  }
}

@layer utilities {
  /* Safe area inset helpers — use as: pb-safe, pt-safe, pl-safe, pr-safe */
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  .pt-safe { padding-top:    env(safe-area-inset-top); }
  .pl-safe { padding-left:   env(safe-area-inset-left); }
  .pr-safe { padding-right:  env(safe-area-inset-right); }

  /* Main content on mobile: clears bottom nav + device home indicator */
  .pb-nav {
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
  }

  /* Horizontal scroll container with right-fade affordance */
  .scroll-x-fade {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .scroll-x-fade::-webkit-scrollbar { display: none; }
  .scroll-x-hint {
    -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
    mask-image:         linear-gradient(to right, black 85%, transparent 100%);
  }
}
`;

write('apps/unified/src/index.css', indexCss);

// ── 3. docs/DESIGN_TOKENS.md ──────────────────────────────────────────
const swatch = (hex: string) => `\`${hex}\``;

const today = new Date().toISOString().slice(0, 10);

const md = `# Reserti Design Tokens

> ⚠️  Plik generowany automatycznie.
> **Nie edytuj ręcznie** — zmień \`design/brand.tokens.ts\`
> i uruchom \`npm run tokens\`.
>
> Ostatnia aktualizacja: ${today}

---

## Brand

| Token                | Wartość                          | Użycie                                   |
|----------------------|----------------------------------|------------------------------------------|
| brand.primary        | ${swatch(BRAND.primary)}         | Przyciski, aktywne chipy, fokus ring     |
| brand.hover          | ${swatch(BRAND.hover)}           | Hover state, sidebar active bg           |
| brand.surface        | ${swatch(BRAND.surface)}         | Tło aktywnego chipa                      |
| brand.surface-hover  | ${swatch(BRAND.surfaceHover)}    | Hover nieaktywnego chipa                 |

## Ink (tekst)

| Token         | Wartość                    | Użycie                                   |
|---------------|----------------------------|------------------------------------------|
| ink.primary   | ${swatch(INK.primary)}     | Główny tekst, nazwy, nagłówki            |
| ink.secondary | ${swatch(INK.secondary)}   | Tekst drugorzędowy, nav inactive         |
| ink.muted     | ${swatch(INK.muted)}       | Placeholder, meta, tooltip               |
| ink.faint     | ${swatch(INK.faint)}       | Nagłówki tabel, disabled                 |

## Border

| Token          | Wartość                     | Użycie                                   |
|----------------|-----------------------------|------------------------------------------|
| border.default | ${swatch(BORDER.default)}   | Inputy, inactive chipy                   |
| border.subtle  | ${swatch(BORDER.subtle)}    | Karty, dropdowny                         |
| border.faint   | ${swatch(BORDER.faint)}     | Separatory wierszy tabeli                |

## Status

| Token    | Kolor                       | Tło                             | Tekst                            |
|----------|-----------------------------|---------------------------------|----------------------------------|
| free     | ${swatch(STATUS.free)}      | ${swatch(STATUS_BG.free)}       | ${swatch(STATUS_TEXT.free)}      |
| pending  | ${swatch(STATUS.pending)}   | ${swatch(STATUS_BG.pending)}    | ${swatch(STATUS_TEXT.pending)}   |
| occ      | ${swatch(STATUS.occ)}       | ${swatch(STATUS_BG.occ)}        | ${swatch(STATUS_TEXT.occ)}       |
| offline  | ${swatch(STATUS.offline)}   | ${swatch(STATUS_BG.offline)}    | ${swatch(STATUS_TEXT.offline)}   |
| info     | ${swatch(STATUS.info)}      | ${swatch(STATUS_BG.info)}       | ${swatch(STATUS_TEXT.info)}      |

## Typografia

| Token        | Wartość          |
|--------------|------------------|
| font.display | ${FONT.display}  |
| font.body    | ${FONT.body}     |

## Border Radius

| Token     | Wartość        | Użycie                               |
|-----------|----------------|---------------------------------------|
| radius.md | ${RADIUS.md}   | Przyciski, chipy, inputy              |
| radius.lg | ${RADIUS.lg}   | Karty, dropdowny                      |
| radius.xl | ${RADIUS.xl}   | Modale, panele                        |

## Icon Sizes

| Token    | Wartość        | Użycie                               |
|----------|----------------|---------------------------------------|
| icon.sm  | ${ICON_SIZE.sm}px | Ikony w przyciskach akcji w-7 h-7 |
| icon.md  | ${ICON_SIZE.md}px | Ikony w nagłówkach sekcji         |
| icon.xl  | ${ICON_SIZE.xl}px | Ikony w EmptyState                |

---

## Wzorzec chip-tab (aktywny/nieaktywny)

\`\`\`tsx
// Aktywny chip
"bg-[#FDF4F9] border-[#B53578] text-[#B53578]"
// Nieaktywny chip
"bg-white border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC]"
// Kształt (zawsze)
"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all"
\`\`\`

## Wzorzec icon button

\`\`\`tsx
// Neutralny
"w-7 h-7 flex items-center justify-center rounded-md border border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC] transition-colors"
// Destrukcyjny (tylko w kebab menu)
"w-7 h-7 flex items-center justify-center rounded-md border border-red-100 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
\`\`\`

## Wzorzec EmptyState

\`\`\`tsx
<EmptyState
  icon={<i className="ti ti-calendar-off text-[#A898B8]" aria-hidden="true" />}
  title={t('some.key')}
  sub={t('some.hint')}
/>
\`\`\`

## Reguły ikon

- Wszystkie ikony: Tabler Icons jako klasy CSS \`ti ti-*\`
- Dekoracyjne: \`aria-hidden="true"\` zawsze
- Zero emoji w JSX — ani tekst, ani ikony
- Destrukcyjne akcje wyłącznie w kebab menu (\`ti-dots-vertical\`)
`;

write('docs/DESIGN_TOKENS.md', md);

console.log('');
console.log('Design tokens wygenerowane pomyslnie.');
console.log('Zcommituj wszystkie zmienione pliki razem.');
