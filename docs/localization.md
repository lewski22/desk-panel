# Localization (i18n) — Desk Panel

This document explains the i18n setup used by the Unified frontend and how to add or update translations.

## Overview

- Library: `i18next` + `react-i18next`.
- Locale files: `apps/unified/src/locales/en/translation.json` and `apps/unified/src/locales/pl/translation.json`.
- Initialization: `apps/unified/src/i18n.ts` (default `lng: 'pl'`, `fallbackLng: 'en'`).
- Language switcher: `apps/unified/src/components/LanguageSwitcher.tsx` (placed in `AppLayout`).

## File structure and conventions

- Keep translations flat under `translation` (current structure is plain JSON nested by feature keys).
- Use human-readable keys grouped by feature, e.g. `pages.login.title`, `provisioning.confirm_delete_gateway`.
- For interpolations use `{{name}}`, `{{count}}` tokens and provide them via `t(key, { name })`.
- For multi-line messages you may include `\n` if required; prefer separate keys for titles and body text.

## Adding a new translation key

1. Add the key to both `en` and `pl` JSON files with appropriate values.
2. Use the key in code with `t('your.key.path')`.
3. If you are unsure about translations, include an English fallback in `t()` while developing.

Example:

```tsx
const { t } = useTranslation();
return <button>{t('btn.save', 'Save')}</button>;
```

## Translating components

- Bring `useTranslation()` into the component that renders text.
- Replace hard-coded strings with `t('...')` keys.
- Avoid calling `t()` inside module-level code (it should run inside component render or hooks).

## Running and testing

- Run `npm run dev` in `apps/unified` and use the LanguageSwitcher in the sidebar to toggle languages.
- To change default language in dev, edit `apps/unified/src/i18n.ts` (`lng` value).

## Common pitfalls

- Missing `useTranslation()` in a component but using `t()` will throw — ensure `const { t } = useTranslation();` is present.
- Forgetting to add the key to both locales will show the fallback language or the key itself.
- Pluralization and context are not yet centrally standardized; prefer simple keys.

## Contributing translations

- If adding many keys, send a PR that updates both `en` and `pl` files.
- Keep commits small and group related keys per feature.

---

If you want, I can:

- Run a repo-wide search to find remaining hard-coded Polish strings and create a list of candidate keys to add.
- Add a small script to validate that all used keys exist in both locale files.
