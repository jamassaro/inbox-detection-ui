import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';
import { apiFetch } from '../../lib/apiClient';
import type { GmailStatus } from '../../hooks/useGmailStatus';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
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

/** Renders the destination pathname — the navigation assertion target. */
const PathProbe = () => {
  const { pathname } = useLocation();
  return <div>probe:{pathname}</div>;
};

const renderSidebar = ({ initialEntry = '/app/dashboard' } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <LocaleProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              {/* PathProbe rides along inside the shell route so on-route assertions work too. */}
              <Route
                path="/app/*"
                element={
                  <>
                    <Sidebar />
                    <PathProbe />
                  </>
                }
              />
              <Route path="*" element={<PathProbe />} />
            </Routes>
          </MemoryRouter>
        </LocaleProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

/** Mocks apiFetch routing by path: connections/stats + investigation POST. */
const stubApi = ({
  status = gmailStatus(),
  investigations,
}: {
  status?: GmailStatus;
  investigations?: () => Promise<unknown>;
} = {}) => {
  mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    // useGmailStatus composes the two REAL endpoints (BE-035 + BE-045):
    // connections for connected/email, stats for lastScan.
    if (path === '/account/connections') {
      return {
        gmail: { connected: status.connected, email: status.email ?? '' },
        calendar: { connected: status.connected },
        gmailCompose: { enabled: status.connected },
      };
    }
    if (path === '/stats') {
      return { lastScan: status.lastSync ? { scanDate: status.lastSync } : null };
    }
    if (path === '/investigation') {
      if (!investigations) throw new Error('unexpected POST /investigation');
      return investigations();
    }
    throw new Error(`unexpected apiFetch: ${path} ${options?.method ?? 'GET'}`);
  });
};

describe('Sidebar', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  describe('navigation items', () => {
    it('renders the V1 nav items with their canonical hrefs (EN)', () => {
      stubApi();
      renderSidebar();

      const expected = [
        { name: 'Dashboard', href: '/app/dashboard' },
        { name: 'Discoveries', href: '/app/discoveries' },
        { name: 'Subscriptions', href: '/app/subscriptions' },
        { name: 'Ask Detective', href: '/app/chat' },
        { name: 'Settings', href: '/app/settings' },
      ];
      for (const { name, href } of expected) {
        const link = screen.getByRole('link', { name });
        expect(link.getAttribute('href')).toBe(href);
      }
      // Dead FE-003 nav is gone.
      expect(screen.queryByRole('link', { name: 'Saved' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Companies' })).toBeNull();
    });

    it('renders translated nav labels in ES', async () => {
      stubApi();
      await i18n.changeLanguage('es');
      renderSidebar();

      const expected = ['Panel', 'Hallazgos', 'Suscripciones', 'Pregunta al Detective', 'Ajustes'];
      for (const name of expected) {
        expect(screen.getByRole('link', { name })).toBeTruthy();
      }
    });

    it('highlights the active nav item (existing white/rounded pattern)', () => {
      stubApi();
      const { container } = renderSidebar({ initialEntry: '/app/discoveries' });

      const active = screen.getByRole('link', { name: 'Discoveries' });
      expect(active.getAttribute('aria-current')).toBe('page');
      expect(active.classList.contains('bg-white')).toBe(true);
      expect(active.classList.contains('rounded-lg')).toBe(true);

      const inactive = screen.getByRole('link', { name: 'Dashboard' });
      expect(inactive.hasAttribute('aria-current')).toBe(false);
      expect(inactive.classList.contains('bg-white')).toBe(false);
      expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Main navigation');
    });
  });

  describe('Gmail status', () => {
    it('shows Connected with a green dot and the email address', async () => {
      stubApi({ status: gmailStatus({ connected: true, email: 'jose@example.com' }) });
      const { container } = renderSidebar();

      // Status text arrives with the resolved query.
      expect(await screen.findByText('Connected · jose@example.com')).toBeTruthy();
      expect(container.querySelector('.bg-green-500')).not.toBeNull();
      // Connected users see no connect link.
      expect(screen.queryByRole('link', { name: 'Connect Gmail' })).toBeNull();
    });

    it('shows Not connected with a gray dot and a Connect Gmail link to /onboarding', async () => {
      stubApi({ status: gmailStatus({ connected: false }) });
      const { container } = renderSidebar();

      // Both the agent badge and the Gmail status line legitimately render this state.
      expect((await screen.findAllByText('Not connected')).length).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('.bg-gray-400')).not.toBeNull();

      const link = screen.getByRole('link', { name: 'Connect Gmail' });
      expect(link.getAttribute('href')).toBe('/onboarding');
    });

    it('renders a neutral placeholder while the status query is loading', () => {
      mockApiFetch.mockImplementation(() => new Promise(() => undefined));
      renderSidebar();

      // No status text claims either state while loading.
      expect(screen.queryByText('Connected')).toBeNull();
      expect(screen.queryByText('Not connected')).toBeNull();
      expect(screen.getByText('Inbox Detective')).toBeTruthy();
    });

    it('treats a status fetch error as not connected (connect fallback)', async () => {
      mockApiFetch.mockRejectedValue(new Error('VITE_API_BASE_URL is not configured.'));
      renderSidebar();

      expect((await screen.findAllByText('Not connected')).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('link', { name: 'Connect Gmail' }).getAttribute('href')).toBe('/onboarding');
    });
  });

  describe('Scan Inbox', () => {
    it('POSTs /investigation on click and navigates to the progress page', async () => {
      stubApi({
        status: gmailStatus({ connected: true, email: 'jose@example.com' }),
        investigations: async () => ({ id: 'inv-1', status: 'running' }),
      });
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Scan Inbox' }));

      await waitFor(() => expect(screen.getByText('probe:/onboarding/investigating')).toBeTruthy());
      expect(mockApiFetch).toHaveBeenCalledWith('/investigation', { method: 'POST' });
    });

    it('shows "Investigating..." disabled while the POST is in flight', async () => {
      stubApi({
        status: gmailStatus({ connected: true }),
        investigations: () => new Promise(() => undefined),
      });
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Scan Inbox' }));

      const investigating = await screen.findByRole('button', { name: 'Investigating...' });
      expect((investigating as HTMLButtonElement).disabled).toBe(true);
      // No navigation while the mutation is pending.
      expect(screen.getByText('probe:/app/dashboard')).toBeTruthy();
    });

    it('shows a translated inline error when the POST fails', async () => {
      stubApi({
        status: gmailStatus({ connected: true }),
        investigations: async () => {
          throw new Error('POST /investigation failed');
        },
      });
      const user = userEvent.setup();
      renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Scan Inbox' }));

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('Could not start the scan. Try again.');
      // Stays on the same route — no navigation on failure.
      expect(screen.getByText('probe:/app/dashboard')).toBeTruthy();
    });
  });

  describe('i18n', () => {
    it('translates the scan button and status copy in ES', async () => {
      stubApi({ status: gmailStatus({ connected: false }) });
      await i18n.changeLanguage('es');
      renderSidebar();

      expect(screen.getByRole('button', { name: 'Escanear bandeja' })).toBeTruthy();
      expect((await screen.findAllByText('No conectado')).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('link', { name: 'Conectar Gmail' })).toBeTruthy();
    });
  });
});
