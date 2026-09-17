import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_STORAGE_KEY } from '../i18n';
import { LocaleContext, normalizeLocale } from './localeContext';
import type { AppLocale } from './localeContext';

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<AppLocale>(() =>
    normalizeLocale(i18n.language),
  );

  const changeLocale = useCallback(
    (next: AppLocale) => {
      void i18n.changeLanguage(next);
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.documentElement.lang = next;
      setLocale(next);
    },
    [i18n],
  );

  const value = useMemo(() => ({ locale, changeLocale }), [locale, changeLocale]);

  // Keep <html lang> in sync on first mount too, so a persisted locale
  // restores the correct document language after a page reload.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};
