import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScanStatusWidget from '../ScanStatusWidget';
import { apiFetch } from '../../lib/apiClient';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import type { InvestigationRecord } from '../../hooks/useInvestigation';
import type { InvestigationStatusWire } from '../../hooks/useInvestigationStatus';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

/** Renders the destination pathname — the navigation assertion target. */
const PathProbe = () => {
  const { pathname, search } = useLocation();
  return <div>probe:{pathname}{search}</div>;
};

const renderWidget = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <LocaleProvider>
          <MemoryRouter initialEntries={['/app/dashboard']}>
            <Routes>
              <Route path="/app/*" element={<><ScanStatusWidget /><PathProbe /></>} />
              <Route path="*" element={<PathProbe />} />
            </Routes>
          </MemoryRouter>
        </LocaleProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

const investigationRecord = (overrides: Partial<InvestigationRecord> = {}): InvestigationRecord => ({
  id: 'inv-1',
  userId: 'usr_test',
  status: 'running',
  emailsDiscovered: 0,
  emailsProcessed: 40,
  emailsClassified: 0,
  subscriptionsFound: 0,
  offersFound: 0,
  discoveriesCreated: 0,
  errorMessage: null,
  startedAt: '2026-09-23T11:00:00.000Z',
  completedAt: null,
  createdAt: '2026-09-23T11:00:00.000Z',
  ...overrides,
});

const statusWire = (overrides: Partial<InvestigationStatusWire> = {}): InvestigationStatusWire => ({
  latestScan: {
    id: 'inv-1',
    status: 'completed',
    startedAt: '2026-09-23T11:00:00.000Z',
    completedAt: '2026-09-23T11:05:00.000Z',
    emailsProcessed: 120,
    emailsDiscovered: 120,
    discoveriesCreated: 3,
  },
  monitoring: { enabled: true, intervalMinutes: 60, nextScanAt: '2026-09-23T12:05:00.000Z' },
  ...overrides,
});

/** Mocks apiFetch routing by path, matching the real endpoint surface this widget touches. */
const stubApi = ({
  status,
  investigation,
  trigger,
}: {
  status: InvestigationStatusWire;
  investigation?: InvestigationRecord;
  trigger?: () => Promise<{ investigationId: string }>;
}) => {
  mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/investigation/status') return status;
    if (path === '/investigation' && options?.method === 'POST') {
      if (!trigger) throw new Error('unexpected POST /investigation');
      return trigger();
    }
    if (path.startsWith('/investigation/')) {
      if (!investigation) throw new Error(`unexpected GET ${path}`);
      return investigation;
    }
    throw new Error(`unexpected apiFetch: ${path} ${options?.method ?? 'GET'}`);
  });
};

describe('ScanStatusWidget', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('is collapsed by default, hiding the panel behind a toggle button', async () => {
    stubApi({ status: statusWire() });
    renderWidget();

    expect(await screen.findByTestId('scan-status-toggle')).toBeTruthy();
    expect(screen.queryByTestId('scan-status-panel')).toBeNull();
  });

  it('opens the panel on click and closes it again on a second click', async () => {
    stubApi({ status: statusWire() });
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByTestId('scan-status-panel')).toBeTruthy();

    await user.click(screen.getByTestId('scan-status-toggle'));
    expect(screen.queryByTestId('scan-status-panel')).toBeNull();
  });

  it('shows the first-scan CTA when latestScan is null, and starts onboarding on click', async () => {
    stubApi({
      status: statusWire({ latestScan: null, monitoring: { enabled: false, intervalMinutes: 60, nextScanAt: null } }),
      trigger: async () => ({ investigationId: 'inv-new' }),
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByText("Your agent hasn't scanned your inbox yet.")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Scan Inbox' }));

    await waitFor(() =>
      expect(screen.getByText('probe:/onboarding/investigating?investigationId=inv-new')).toBeTruthy(),
    );
  });

  it('shows the last-scan summary with a pluralized discovery count', async () => {
    stubApi({ status: statusWire() });
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByText(/Last scan finished/)).toBeTruthy();
    expect(screen.getByText(/found 3 discoveries/)).toBeTruthy();
    expect(screen.getByTestId('lookback-range').textContent).toBe(
      'Reviewed the last 14 days: September 9, 2026 – September 23, 2026',
    );
  });

  it('shows a blue pulsing dot and a live progress view while the latest scan is running', async () => {
    stubApi({
      status: statusWire({
        latestScan: {
          id: 'inv-1',
          status: 'running',
          startedAt: '2026-09-23T11:00:00.000Z',
          completedAt: null,
          emailsProcessed: 0,
          emailsDiscovered: 0,
          discoveriesCreated: 0,
        },
      }),
      investigation: investigationRecord({ status: 'running', emailsProcessed: 40 }),
    });
    const user = userEvent.setup();
    renderWidget();

    await waitFor(() => expect(document.querySelector('.bg-blue-500')).not.toBeNull());
    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByText('Scanning your inbox…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('40')).toBeTruthy(), { timeout: 3000 });
    // Lookback window anchored at the run's own startedAt (14 days back).
    expect(screen.getByTestId('lookback-range').textContent).toBe(
      'Now reviewing the last 14 days: September 9, 2026 – September 23, 2026',
    );
  });

  it('shows a red dot and an error state with retry when the latest scan failed', async () => {
    stubApi({
      status: statusWire({
        latestScan: {
          id: 'inv-1',
          status: 'failed',
          startedAt: '2026-09-23T11:00:00.000Z',
          completedAt: '2026-09-23T11:01:00.000Z',
          emailsProcessed: 5,
          emailsDiscovered: 0,
          discoveriesCreated: 0,
        },
      }),
      trigger: async () => ({ investigationId: 'inv-retry' }),
      investigation: investigationRecord({ id: 'inv-retry', status: 'running', emailsProcessed: 0 }),
    });
    const user = userEvent.setup();
    renderWidget();

    await waitFor(() => expect(document.querySelector('.bg-red-500')).not.toBeNull());
    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByText('The last scan failed.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/investigation', { method: 'POST' }));
    // Stays on the dashboard (inline retry, unlike the first-scan CTA).
    expect(screen.getByText('probe:/app/dashboard')).toBeTruthy();
  });

  it('shows the next automatic scan time when monitoring is enabled, and the upgrade prompt when disabled', async () => {
    stubApi({ status: statusWire() });
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByTestId('next-scan')).toBeTruthy();
    expect(screen.getByTestId('next-scan').textContent).toContain('Next automatic scan');

    cleanup();
    stubApi({ status: statusWire({ monitoring: { enabled: false, intervalMinutes: 60, nextScanAt: null } }) });
    renderWidget();
    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByTestId('upgrade-prompt')).toBeTruthy();
    expect(screen.queryByTestId('next-scan')).toBeNull();
  });

  it('shows an error state with retry when the status fetch itself fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    renderWidget();

    await waitFor(() => expect(document.querySelector('.bg-red-500')).not.toBeNull());
    await user.click(await screen.findByTestId('scan-status-toggle'));
    expect(await screen.findByText("Couldn't load scan status.")).toBeTruthy();
  });
});
