import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectGmailPage from '../ConnectGmailPage';
import { apiFetch } from '../../../lib/apiClient';
import { ApiError } from '../../../lib/apiError';
import type { GmailStatus } from '../../../hooks/useGmailStatus';
import { AuthProvider } from '../../../contexts/AuthProvider';
import { ToastProvider } from '../../../contexts/ToastProvider';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { stubWindowLocation } from '../../../test-utils';
import i18n from '../../../i18n';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const gmailStatus = (overrides: Partial<GmailStatus> = {}): GmailStatus => ({
  connected: false,
  email: null,
  lastSync: null,
  ...overrides,
});

/**
 * Serves the TWO real endpoints behind useGmailStatus (verified 2026-09-17 —
 * there is no GET /gmail/status): /account/connections for connected/email,
 * /stats for lastScan.
 */
const stubGmailStatus = (status: GmailStatus): void => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/account/connections') {
      return Promise.resolve({
        gmail: { connected: status.connected, email: status.email ?? '' },
        calendar: { connected: status.connected },
        gmailCompose: { enabled: status.connected },
      }) as ReturnType<typeof apiFetch>;
    }
    if (path === '/stats') {
      return Promise.resolve({
        lastScan: status.lastSync ? { scanDate: status.lastSync } : null,
      }) as ReturnType<typeof apiFetch>;
    }
    return Promise.reject(new Error(`unexpected apiFetch: ${path}`)) as ReturnType<typeof apiFetch>;
  });
};

/** Renders the destination pathname — the redirect assertion target. */
const PathProbe = () => {
  const { pathname } = useLocation();
  return <div>probe:{pathname}</div>;
};

const renderPage = ({
  initialEntry = '/onboarding',
  behindProtectedRoute = false,
}: { initialEntry?: string; behindProtectedRoute?: boolean } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // AuthProvider (real, like main.tsx) is only mounted for the protected
  // test — it fires GET /account/me on mount and would consume apiFetch mocks
  // queued for the page's status check.
  const tree = (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            {behindProtectedRoute ? (
              <Route element={<ProtectedRoute />}>
                <Route path="/onboarding" element={<ConnectGmailPage />} />
              </Route>
            ) : (
              <Route path="/onboarding" element={<ConnectGmailPage />} />
            )}
            <Route path="*" element={<PathProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
  return render(
    <I18nextProvider i18n={i18n}>
      {behindProtectedRoute ? <AuthProvider>{tree}</AuthProvider> : tree}
    </I18nextProvider>,
  );
};

describe('ConnectGmailPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    vi.unstubAllEnvs();
    // i18n is a singleton — restore the default language so the English
    // tests are never poisoned by a Spanish render.
    await i18n.changeLanguage('en');
  });

  it('renders the explanation, a single CTA, and the privacy link once status resolves', async () => {
    stubGmailStatus(gmailStatus());
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Connect your inbox' })).toBeTruthy();
    // Honest, specific access disclosure (ticket requirement): what is read
    // (subject, sender, body) — not vague AI-speak.
    expect(screen.getByText(/subject, sender, and body/)).toBeTruthy();
    expect(screen.getByText(/to find subscription renewals/)).toBeTruthy();

    // Exactly one action on this step.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeTruthy();

    // Privacy assurance links to /privacy.
    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink.getAttribute('href')).toBe('/privacy');
  });

  it('redirects to /app/dashboard when Gmail is already connected (post-OAuth return)', async () => {
    stubGmailStatus(
      gmailStatus({ connected: true, email: 'ada@example.com', lastSync: '2026-09-17T10:00:00Z' }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('probe:/app/dashboard')).toBeTruthy());
  });

  it('shows the translated loading state while the status check runs', () => {
    mockApiFetch.mockImplementation(() => new Promise<GmailStatus>(() => {}));
    renderPage();

    // ToastProvider also renders an (empty) role="status" container, so the
    // spinner is matched by its accessible name.
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.getByText('Checking your Gmail connection…')).toBeTruthy();
    // No action available while checking.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the OAuth error state with a retry CTA when the backend returns ?error=', async () => {
    stubGmailStatus(gmailStatus());
    renderPage({ initialEntry: '/onboarding?error=access_denied' });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("We couldn't connect your Gmail. Please try again.");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('retry on the OAuth error restarts the Gmail OAuth flow via full-page redirect', async () => {
    const location = stubWindowLocation();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    stubGmailStatus(gmailStatus());
    renderPage({ initialEntry: '/onboarding?error=access_denied' });

    const user = userEvent.setup();
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // There is no /gmail/connect — re-connect rides the sign-in OAuth chain
    // (GET /auth/google already requests gmail.readonly).
    expect(location.href).toBe('https://api.example.test/auth/google');
    consoleError.mockRestore();
    location.restore();
  });

  it('connect CTA navigates nowhere and shows the translated fallback when the API base URL is unset', async () => {
    const location = stubWindowLocation();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('VITE_API_BASE_URL', '');
    stubGmailStatus(gmailStatus());
    renderPage();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Connect Gmail' });
    await user.click(screen.getByRole('button', { name: 'Connect Gmail' }));

    // No navigation to an undefined URL.
    expect(location.href).toBe('');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('VITE_API_BASE_URL is not configured'),
    );
    // Translated fallback toast — FE-007 landing pattern.
    const toast = await screen.findByTestId('toast-error');
    expect(toast.textContent).toContain(
      'Gmail connection is temporarily unavailable. Please try again in a moment.',
    );
    consoleError.mockRestore();
    location.restore();
  });

  it('redirects unauthenticated visits from /onboarding to / (ProtectedRoute)', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'no session')); // GET /account/me
    renderPage({ behindProtectedRoute: true });

    await waitFor(() => expect(screen.getByText('probe:/')).toBeTruthy());
    // The Gmail status check never even mounts behind the FE-003 guard.
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/account/me', { authExpiredEvent: false });
    expect(mockApiFetch).not.toHaveBeenCalledWith('/account/connections');
  });

  it('renders the connect copy in Spanish across the offer, loading, and error states', async () => {
    await i18n.changeLanguage('es');

    // Offer state.
    stubGmailStatus(gmailStatus());
    const offer = renderPage();
    expect(await offer.findByRole('heading', { name: 'Conecta tu bandeja' })).toBeTruthy();
    expect(offer.getByText(/asunto, el remitente y el cuerpo/)).toBeTruthy();
    expect(offer.getByRole('button', { name: 'Conectar Gmail' })).toBeTruthy();
    expect(offer.getByRole('link', { name: 'Política de Privacidad' })).toBeTruthy();
    offer.unmount();

    // Loading state.
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(() => new Promise<GmailStatus>(() => {}));
    const loading = renderPage();
    expect(loading.getByText('Comprobando tu conexión de Gmail…')).toBeTruthy();
    loading.unmount();

    // Error state.
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValueOnce(gmailStatus());
    const error = renderPage({ initialEntry: '/onboarding?error=access_denied' });
    const alert = await error.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos conectar tu Gmail. Inténtalo de nuevo.');
    expect(error.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
