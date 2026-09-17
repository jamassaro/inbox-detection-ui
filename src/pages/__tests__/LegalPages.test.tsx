import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PrivacyPolicyPage from '../PrivacyPolicyPage';
import TermsPage from '../TermsPage';
import i18n from '../../i18n';

// Reset language and DOM between tests so the EN assertions never observe a
// language left over from a preceding ES test.
beforeEach(() => {
  void i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
  cleanup();
});

// FE-026: static legal pages. Routes /privacy and /terms are public (FE-003);
// the landing-footer link coverage already lives in LandingPage.test.tsx.
const renderPage = (ui: React.ReactElement) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );

const SECTION_HEADINGS = [
  'Introduction',
  'What we collect',
  'How we use it',
  'Gmail access',
  'Data deletion',
  'Contact',
];

describe('PrivacyPolicyPage', () => {
  it('renders the full document without authentication', () => {
    renderPage(<PrivacyPolicyPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeTruthy();
    expect(screen.getByText(/Last updated:/)).toBeTruthy();
    for (const heading of SECTION_HEADINGS) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeTruthy();
    }
    // Legal copy is explicitly marked as placeholder until product supplies it.
    expect(screen.getByTestId('placeholder-notice')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to home/ }).getAttribute('href')).toBe('/');
  });

  it('translates the heading and sections to Spanish', async () => {
    await i18n.changeLanguage('es');
    renderPage(<PrivacyPolicyPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de Privacidad' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Eliminación de datos' }),
    ).toBeTruthy();
  });
});

describe('TermsPage', () => {
  it('renders the full document without authentication', () => {
    renderPage(<TermsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Service' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Gmail access' })).toBeTruthy();
    expect(screen.getByTestId('placeholder-notice')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to home/ }).getAttribute('href')).toBe('/');
  });

  it('translates the heading to Spanish', async () => {
    await i18n.changeLanguage('es');
    renderPage(<TermsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Términos de Servicio' }),
    ).toBeTruthy();
  });
});
