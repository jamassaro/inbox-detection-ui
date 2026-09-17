import { useContext } from 'react';
import { LocaleContext } from '../contexts/localeContext';
import type { AppLocale } from '../contexts/localeContext';

export type { AppLocale } from '../contexts/localeContext';

/**
 * Exposes the active locale and a changeLocale() setter.
 *
 * changeLocale() switches i18next's language immediately (no reload),
 * persists the choice to localStorage under `inbox-detective-locale`,
 * and keeps <html lang> in sync for accessibility.
 */
export const useLocale = (): { locale: AppLocale; changeLocale: (locale: AppLocale) => void } => {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
};
