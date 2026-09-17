import { createContext } from 'react';

export type AppLocale = 'en' | 'es';

export interface LocaleContextValue {
  locale: AppLocale;
  changeLocale: (locale: AppLocale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export const normalizeLocale = (value: string | null | undefined): AppLocale =>
  value === 'es' ? 'es' : 'en';
