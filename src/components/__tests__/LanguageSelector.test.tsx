import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import LanguageSelector from '../LanguageSelector';

const renderSelector = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <LanguageSelector />
      </LocaleProvider>
    </I18nextProvider>,
  );

afterEach(cleanup);

describe('LanguageSelector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders both locale options with per-language aria-labels', () => {
    renderSelector();
    expect(screen.getByRole('button', { name: /language/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /idioma/i })).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
    expect(screen.getByText('ES')).toBeTruthy();
  });

  it('buttons are keyboard accessible and aria-labelled in both languages', () => {
    renderSelector();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
