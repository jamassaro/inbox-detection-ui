import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from '../AuthCallbackPage';
import { apiFetch } from '../../lib/apiClient';
import { AuthProvider } from '../../contexts/AuthContext';
import { RETURN_PATH_STORAGE_KEY } from '../../hooks/useGoogleAuth';
import { stubWindowLocation } from '../../test-utils';
import i18n from '../../i18n';
import type { User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const userWithoutGmail: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };
const userWithGmail: User = { ...userWithoutGmail, gmailConnected: true };

/** Renders the destination pathname — the redirect assertion target. */
const PathProbe = () => {
  const { pathname } = useLocation();
  return <div>probe:{pathname}</div>;
};

// Wrapper mirrors main.tsx provider order. AuthProvider is real (it composes
// with the page's session resolution — see AuthCallbackPage) while apiFetch
// is mocked, so the /auth/me call count is assertable.
const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/auth/callback']}>
            <Routes>
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="*" element={<PathProbe />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>,
  );
};

describe('AuthCallbackPage', () => {
  let location: ReturnType<typeof stubWindowLocation>;

  beforeEach(() => {
    location = stubWindowLocation();
    mockApiFetch.mockReset();
    sessionStorage.clear();
  });

  afterEach(async () => {
    cleanup();
    sessionStorage.clear();
    location.restore();
    await i18n.changeLanguage('en');
  });

  it('shows the translated loading state while the session resolves', () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockImplementation(() => new Promise<User>(() => {})); // never settles
    renderPage();

    // Exactly one status landmark (the spinner) + the visible translated copy.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Signing you in…')).toBeTruthy();
  });

  it('lands on /onboarding after auth without Gmail connected — one /auth/me fetch total', async () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockResolvedValueOnce(userWithoutGmail);
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/onboarding')).toBeTruthy());
    // Composition: AuthProvider's mount-time session check resolved the user,
    // so the page must NOT fire a second GET /auth/me.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me');
  });

  it('lands on /app/dashboard when Gmail is already connected', async () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockResolvedValueOnce(userWithGmail);
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/app/dashboard')).toBeTruthy());
  });

  it('honors the sessionStorage returnPath over the Gmail-based destination and consumes it', async () => {
    window.location.search = '?code=abc';
    sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, '/app/discoveries/d1');
    mockApiFetch.mockResolvedValueOnce(userWithGmail);
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/app/discoveries/d1')).toBeTruthy());
    expect(sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBeNull();
  });

  it('ignores an off-site returnPath and falls back to the Gmail-based destination', async () => {
    window.location.search = '?code=abc';
    sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, 'https://evil.example');
    mockApiFetch.mockResolvedValueOnce(userWithGmail);
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/app/dashboard')).toBeTruthy());
  });

  it('resolves the session via the page Query when AuthProvider missed it', async () => {
    window.location.search = '?code=abc';
    mockApiFetch
      .mockRejectedValueOnce(new Error('transient')) // AuthProvider's check fails
      .mockResolvedValueOnce(userWithGmail); // the page Query retries and wins
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/app/dashboard')).toBeTruthy());
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('shows the error state with a retry CTA when the session check fails — history untouched', async () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockRejectedValue(new Error('no session'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("We couldn't complete sign-in. Please try again.");

    // Back-button criterion: the failure must never rewrite history.
    expect(location.replace).not.toHaveBeenCalled();

    const retry = screen.getByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByText('probe:/')).toBeTruthy());
  });

  it('fails fast on a missing code param without a session check', async () => {
    // stub default: window.location.search === ''
    mockApiFetch.mockResolvedValueOnce(userWithGmail); // only AuthProvider's own check
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("We couldn't complete sign-in. Please try again.");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('fails fast when the backend redirected back with an error param', async () => {
    window.location.search = '?error=access_denied';
    renderPage();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders the loading and error states in Spanish', async () => {
    await i18n.changeLanguage('es');

    // Loading state (session never resolves).
    window.location.search = '?code=abc';
    mockApiFetch.mockImplementation(() => new Promise<User>(() => {}));
    const loading = renderPage();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Iniciando sesión…')).toBeTruthy();
    loading.unmount();

    // Error state (no code param).
    mockApiFetch.mockReset();
    window.location.search = '';
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos completar el inicio de sesión. Inténtalo de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
