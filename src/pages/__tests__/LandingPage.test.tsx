import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// vite/client types cover `?raw`; the app tsconfig has no node types.
import indexHtml from '../../../index.html?raw';
import LandingPage from '../LandingPage';
import i18n from '../../i18n';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import { ToastProvider } from '../../contexts/ToastProvider';
import { AuthContext } from '../../contexts/authContext';
import type { AuthContextValue } from '../../contexts/authContext';

const { mockStartGoogleAuth } = vi.hoisted(() => ({ mockStartGoogleAuth: vi.fn() }));

// FE-007: sign-in CTAs start the OAuth flow through useGoogleAuth — mocked
// so tests assert the call instead of triggering full-page navigation.
vi.mock('../../hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ startGoogleAuth: mockStartGoogleAuth }),
}));

// LandingPage never fetches: auth state arrives via AuthContext, so tests
// stub the context value directly instead of mocking apiClient.
const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  logout: vi.fn(),
  ...overrides,
});

const renderLanding = (auth: AuthContextValue = authValue()) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <MemoryRouter>
          <LocaleProvider>
            <AuthContext.Provider value={auth}>
              <LandingPage />
            </AuthContext.Provider>
          </LocaleProvider>
        </MemoryRouter>
      </ToastProvider>
    </I18nextProvider>,
  );

const signedInAuth = (): AuthContextValue =>
  authValue({
    isAuthenticated: true,
    user: { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' },
  });

beforeEach(() => {
  window.localStorage.clear();
  mockStartGoogleAuth.mockReset();
});

afterEach(async () => {
  cleanup();
  // i18n is a singleton — restore the default language so the English
  // tests are never poisoned by a Spanish render.
  await i18n.changeLanguage('en');
});

describe('LandingPage', () => {
  it('renders every section in English for signed-out visitors', () => {
    renderLanding();

    // Navigation bar + hero headline
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: "Your inbox knows things you don't." }),
    ).toBeTruthy();

    // One heading per marketing section, in the ticket's scope order.
    const sectionTitles = [
      'Email is where deals go to die', // Problem
      'What an investigation surfaces', // Discovery examples
      'From chaos to clarity in four steps', // How it works
      'Start with a free investigation', // Free investigation
      'An agent that keeps working after the first scan', // Agent capabilities
      'Free vs Pro', // Free vs Pro comparison
      'Simple pricing', // Pricing
      'Frequently asked questions', // FAQ
      'Find out what your inbox is hiding.', // Final CTA
    ];
    for (const title of sectionTitles) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }

    // Pricing amounts: Free $0 / Pro $5.99 per month / $49 per year
    expect(screen.getByText('$0')).toBeTruthy();
    expect(screen.getByText('$5.99')).toBeTruthy();
    expect(screen.getByText('$49')).toBeTruthy();
    expect(screen.getByText('/month')).toBeTruthy();
    expect(screen.getByText('/year')).toBeTruthy();

    // Static discovery examples render (no API data on the landing page)
    expect(screen.getByText('Streamflix')).toBeTruthy();
    expect(screen.getByText('CloudNine Storage')).toBeTruthy();
    expect(screen.getByText('FitGym')).toBeTruthy();

    // Footer closes the page
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('points every visitor CTA and Sign in at the Google auth entry point', () => {
    renderLanding();

    const ctas = screen.getAllByRole('link', { name: 'Investigate my inbox' });
    expect(ctas.length).toBeGreaterThanOrEqual(3); // nav, hero, free tier, final CTA
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/auth/google');
    }
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth/google');
  });

  it('starts the OAuth flow with the dashboard return path when a visitor CTA is clicked', async () => {
    renderLanding();

    await userEvent.click(screen.getAllByRole('link', { name: 'Investigate my inbox' })[0]);

    expect(mockStartGoogleAuth).toHaveBeenCalledTimes(1);
    expect(mockStartGoogleAuth).toHaveBeenCalledWith({ returnPath: '/app/dashboard' });
  });

  it('starts the OAuth flow from the Sign in nav link too', async () => {
    renderLanding();

    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(mockStartGoogleAuth).toHaveBeenCalledTimes(1);
    expect(mockStartGoogleAuth).toHaveBeenCalledWith({ returnPath: '/app/dashboard' });
  });

  it('never starts the OAuth flow for signed-in users clicking Go to app', async () => {
    renderLanding(signedInAuth());

    await userEvent.click(screen.getAllByRole('link', { name: 'Go to app' })[0]);

    expect(mockStartGoogleAuth).not.toHaveBeenCalled();
  });

  it('explains the failure with a translated toast when the auth start is refused', async () => {
    mockStartGoogleAuth.mockReturnValue(false); // VITE_API_BASE_URL unconfigured
    renderLanding();

    await userEvent.click(screen.getAllByRole('link', { name: 'Investigate my inbox' })[0]);

    expect(
      screen.getByText('Sign-in is temporarily unavailable. Please try again in a moment.'),
    ).toBeTruthy();
  });

  it('shows the LanguageSelector in the nav bar', () => {
    renderLanding();

    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByText('EN')).toBeTruthy();
    expect(nav.getByText('ES')).toBeTruthy();
    expect(nav.getByRole('button', { name: /language/i })).toBeTruthy();
  });

  it('links the footer to /privacy and /terms', () => {
    renderLanding();

    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'),
    ).toBe('/privacy');
    expect(within(footer).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
  });

  it('renders the full page in Spanish after switching language', async () => {
    await i18n.changeLanguage('es');
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tu bandeja de entrada sabe cosas que tú no.',
      }),
    ).toBeTruthy();
    const ctas = screen.getAllByRole('link', { name: 'Investigar mi bandeja' });
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/auth/google');
    }
    // Frequency units come from the billing namespace in Spanish.
    expect(screen.getByText('/mes')).toBeTruthy();
    expect(screen.getByText('/año')).toBeTruthy();
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Política de Privacidad' }).getAttribute('href'),
    ).toBe('/privacy');
  });

  it('greets authenticated users with Go to app instead of Sign in', () => {
    renderLanding(signedInAuth());

    const appLinks = screen.getAllByRole('link', { name: 'Go to app' });
    expect(appLinks.length).toBeGreaterThanOrEqual(2); // nav + hero + free tier + final CTA
    for (const link of appLinks) {
      expect(link.getAttribute('href')).toBe('/app/dashboard');
    }
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Investigate my inbox' })).toBeNull();
  });

  it('ships the Inbox Detective title and a meta description in index.html', () => {
    // vitest's jsdom does not parse index.html, so assert on the file itself.
    expect(indexHtml).toContain('<title>Inbox Detective</title>');
    expect(indexHtml).toContain('name="description"');
  });
});
