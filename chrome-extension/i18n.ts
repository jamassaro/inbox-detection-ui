import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../src/i18n/locales/en/common.json';
import enDiscoveries from '../src/i18n/locales/en/discoveries.json';
import enErrors from '../src/i18n/locales/en/errors.json';
import esCommon from '../src/i18n/locales/es/common.json';
import esDiscoveries from '../src/i18n/locales/es/discoveries.json';
import esErrors from '../src/i18n/locales/es/errors.json';

/**
 * Dedicated i18n instance. The app's instance uses a localStorage detector,
 * which inside Gmail would read (and write) Gmail's own storage — so the
 * extension derives its locale from the browser only.
 */
export const detectLocale = (): 'en' | 'es' =>
  navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';

const instance = i18n.createInstance();

void instance.use(initReactI18next).init({
  lng: detectLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'discoveries', 'errors'],
  initAsync: false,
  resources: {
    en: { common: enCommon, discoveries: enDiscoveries, errors: enErrors },
    es: { common: esCommon, discoveries: esDiscoveries, errors: esErrors },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default instance;
