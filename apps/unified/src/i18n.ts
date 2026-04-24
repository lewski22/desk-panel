import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pl from './locales/pl/translation.json';
import en from './locales/en/translation.json';

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
  },
  lng:          'pl',
  fallbackLng:  'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng; });

export default i18n;
