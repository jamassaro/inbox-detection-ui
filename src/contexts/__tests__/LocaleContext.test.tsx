import { cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n, { LOCALE_STORAGE_KEY } from '../../i18n';
import { LocaleProvider } from '../LocaleProvider';
import { normalizeLocale } from '../localeContext';
import { useLocale } from '../../hooks/useLocale';

const Probe = () => {
  const { locale, changeLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => changeLocale('es')}>
        switch
      </button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    </I18nextProvider>,
  );

describe('LocaleProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  describe('normalizeLocale', () => {
    it('accepts the exact supported locales', () => {
      expect(normalizeLocale('es')).toBe('es');
      expect(normalizeLocale('en')).toBe('en');
    });

    it('falls back to en for anything the app does not support', () => {
      expect(normalizeLocale('fr')).toBe('en');
      // i18next resolves regional variants to the base language before this
      // runs (load: 'languageOnly'), so the exact-match contract holds.
      expect(normalizeLocale('es-MX')).toBe('en');
      expect(normalizeLocale(null)).toBe('en');
      expect(normalizeLocale(undefined)).toBe('en');
    });
  });

  it('throws when useLocale is used outside a LocaleProvider', () => {
    expect(() => renderHook(() => useLocale())).toThrow(
      'useLocale must be used within a LocaleProvider',
    );
  });

  it('restores a persisted locale on first mount and syncs <html lang> without interaction', async () => {
    // Simulate the reload path: the detector reads localStorage at init, so
    // i18next is already on es when the provider mounts.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    await i18n.changeLanguage('es');

    renderProbe();
    expect(screen.getByTestId('locale').textContent).toBe('es');
    // The mount effect keeps the accessibility language in sync even when
    // the user never touches the selector.
    expect(document.documentElement.lang).toBe('es');
  });

  it('changeLocale switches i18next itself, not just the context state', async () => {
    renderProbe();

    await userEvent.click(screen.getByText('switch'));

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(i18n.language).toBe('es');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });
});
