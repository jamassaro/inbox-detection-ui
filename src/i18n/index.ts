import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enPublic from './locales/en/public.json';
import enOnboarding from './locales/en/onboarding.json';
import enInvestigation from './locales/en/investigation.json';
import enDiscoveries from './locales/en/discoveries.json';
import enSubscriptions from './locales/en/subscriptions.json';
import enDetective from './locales/en/detective.json';
import enCalendar from './locales/en/calendar.json';
import enReminders from './locales/en/reminders.json';
import enBilling from './locales/en/billing.json';
import enSettings from './locales/en/settings.json';
import enErrors from './locales/en/errors.json';

import esCommon from './locales/es/common.json';
import esPublic from './locales/es/public.json';
import esOnboarding from './locales/es/onboarding.json';
import esInvestigation from './locales/es/investigation.json';
import esDiscoveries from './locales/es/discoveries.json';
import esSubscriptions from './locales/es/subscriptions.json';
import esDetective from './locales/es/detective.json';
import esCalendar from './locales/es/calendar.json';
import esReminders from './locales/es/reminders.json';
import esBilling from './locales/es/billing.json';
import esSettings from './locales/es/settings.json';
import esErrors from './locales/es/errors.json';

export const LOCALE_STORAGE_KEY = 'inbox-detective-locale';

export const namespaces = [
  'common',
  'public',
  'onboarding',
  'investigation',
  'discoveries',
  'subscriptions',
  'detective',
  'calendar',
  'reminders',
  'billing',
  'settings',
  'errors',
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Maps es-MX / es-CL / etc. to `es` so regional variants fall back to
    // the base language instead of the `en` fallback.
    load: 'languageOnly',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [...namespaces],
    supportedLngs: ['en', 'es'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    resources: {
      en: {
        common: enCommon,
        public: enPublic,
        onboarding: enOnboarding,
        investigation: enInvestigation,
        discoveries: enDiscoveries,
        subscriptions: enSubscriptions,
        detective: enDetective,
        calendar: enCalendar,
        reminders: enReminders,
        billing: enBilling,
        settings: enSettings,
        errors: enErrors,
      },
      es: {
        common: esCommon,
        public: esPublic,
        onboarding: esOnboarding,
        investigation: esInvestigation,
        discoveries: esDiscoveries,
        subscriptions: esSubscriptions,
        detective: esDetective,
        calendar: esCalendar,
        reminders: esReminders,
        billing: esBilling,
        settings: esSettings,
        errors: esErrors,
      },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnEmptyString: false,
  });

export default i18n;
