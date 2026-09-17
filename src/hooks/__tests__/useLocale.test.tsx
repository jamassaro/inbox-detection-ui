import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n, { LOCALE_STORAGE_KEY } from '../../i18n';
import { LocaleProvider } from '../../contexts/LocaleContext';
import { useLocale } from '../useLocale';

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

afterEach(cleanup);

describe('useLocale', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  it('defaults to English', () => {
    renderProbe();
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('changeLocale switches immediately without reload and persists to localStorage', () => {
    renderProbe();
    act(() => {
      screen.getByText('switch').click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });

  it('changeLocale updates document.documentElement.lang', () => {
    renderProbe();
    act(() => {
      screen.getByText('switch').click();
    });
    expect(document.documentElement.lang).toBe('es');
  });
});
