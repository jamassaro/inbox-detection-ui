import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvestigationProgressPage from '../InvestigationProgressPage';
import { apiFetch } from '../../../lib/apiClient';
import { INVESTIGATION_POLL_INTERVAL_MS } from '../../../hooks/useInvestigation';
import type { InvestigationRecord } from '../../../hooks/useInvestigation';
import { stubWindowLocation } from '../../../test-utils';
import { LocaleProvider } from '../../../contexts/LocaleProvider';
import i18n from '../../../i18n';

vi.mock('../../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireInvestigation = (overrides: Partial<InvestigationRecord> = {}): InvestigationRecord => ({
  id: 'inv-1',
  userId: 'usr_test',
  status: 'queued',
  emailsDiscovered: 0,
  emailsProcessed: 0,
  emailsClassified: 0,
  subscriptionsFound: 0,
  offersFound: 0,
  discoveriesCreated: 0,
  errorMessage: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

/** Renders the current pathname — the navigation assertion target. */
const PathProbe = () => {
  const { pathname } = useLocation();
  return <div>probe:{pathname}</div>;
};

const renderPage = ({ initialEntry = '/onboarding/investigating' }: { initialEntry?: string } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/onboarding/investigating" element={<InvestigationProgressPage />} />
              <Route path="/onboarding/results" element={<div>probe:/onboarding/results</div>} />
              <Route path="*" element={<PathProbe />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>,
  );
};

// Under vitest fake timers, RTL's findBy*/waitFor hang (their polling runs
// on real timers). Every async assertion therefore advances the fake clock
// and reads synchronously.
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

/** Lets the count-up tween run to completion before asserting a number. */
const settle = async () => {
  await advance(1000);
};

describe('InvestigationProgressPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    vi.useFakeTimers();
    stubWindowLocation();
  });

  afterEach(async () => {
    cleanup();
    vi.unstubAllEnvs();
    await i18n.changeLanguage('en');
    await advance(0);
    vi.useRealTimers();
  });

  it('renders the live progress view with a real counter while running', async () => {
    mockApiFetch.mockResolvedValue(
      wireInvestigation({ status: 'running', emailsProcessed: 57, subscriptionsFound: 2 }),
    );
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    await settle();
    expect(screen.getByRole('heading', { name: 'Investigating your inbox…' })).toBeTruthy();
    expect(screen.getByText('57')).toBeTruthy();
    expect(screen.getByText('Reviewing your emails…')).toBeTruthy();
    // The real per-category count from subscriptionsFound is shown.
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('auto-triggers exactly one investigation on mount and shows the starting state', async () => {
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'queued' }));
    renderPage();

    // The trigger POST is the first call; polling picks the id up after.
    await advance(0);
    const postCalls = mockApiFetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0][0]).toBe('/investigation');
    expect(screen.getByText('Starting investigation…')).toBeTruthy();
  });

  it('guards against double-POST: re-renders from polling state never re-trigger', async () => {
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'queued' }));
    renderPage();

    // Poll cycles re-render the page many times; each render re-runs the
    // trigger effect's guard. Only the first invocation may POST.
    await advance(0);
    await advance(INVESTIGATION_POLL_INTERVAL_MS * 4);
    const postCalls = mockApiFetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0][0]).toBe('/investigation');
  });

  it('does not POST when an investigation id is already in the URL (post-OAuth return)', async () => {
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'running', emailsProcessed: 12 }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-9' });

    await advance(0);
    await settle();
    const postCalls = mockApiFetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(0);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('navigates to /onboarding/results when the run completes', async () => {
    mockApiFetch
      // Polls 1-2: still running.
      .mockResolvedValueOnce(wireInvestigation({ status: 'running', emailsProcessed: 10 }))
      // Poll 3: complete.
      .mockResolvedValue(wireInvestigation({ status: 'completed', emailsProcessed: 220, completedAt: '2026-09-17T12:00:00.000Z' }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    await advance(3000);
    await advance(3000);
    expect(screen.getByText('probe:/onboarding/results')).toBeTruthy();
  });

  it('renders the failed state with the backend error and retries', async () => {
    mockApiFetch
      .mockResolvedValueOnce(wireInvestigation({ status: 'failed', errorMessage: 'Gmail worker crashed' }))
      // After retry: a fresh investigation starts.
      .mockResolvedValue(wireInvestigation({ id: 'inv-2', status: 'queued' }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    expect(screen.getByText('Investigation failed')).toBeTruthy();
    expect(screen.getByText('Gmail worker crashed')).toBeTruthy();

    // fireEvent rather than userEvent: userEvent's internal waits hang under
    // vitest fake timers.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await advance(0);
    const postCalls = mockApiFetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(screen.getByText('Starting investigation…')).toBeTruthy();
  });

  it('surfaces the trigger failure with a retry when the POST itself fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('backend down'));
    renderPage();

    await advance(0);
    expect(
      screen.getByText("We couldn't start your investigation. Please try again."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders the partial state with a continue-to-results action', async () => {
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'partial', emailsProcessed: 90 }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    expect(screen.getByText('Investigation partially completed')).toBeTruthy();
    expect(
      screen.getByText(
        'We finished part of your investigation, but something interrupted it. You can review the discoveries found so far.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to results' }));
    expect(screen.getByText('probe:/onboarding/results')).toBeTruthy();
  });

  it('shows the timeout message after 5 minutes of an active run — no infinite spinner', async () => {
    // Every poll returns "running" forever.
    mockApiFetch.mockResolvedValue(wireInvestigation({ status: 'running', emailsProcessed: 5 }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    expect(screen.getByText('Reviewing your emails…')).toBeTruthy();

    // Just before the threshold: still the progress view.
    await advance(5 * 60 * 1000 - 1000);
    expect(screen.queryByText('This is taking longer than expected')).toBeNull();

    // Crossing the threshold surfaces the timeout message.
    await advance(1000);
    expect(screen.getByText('This is taking longer than expected')).toBeTruthy();
    expect(
      screen.getByText(
        "Your investigation is still running in the background, but it hasn't finished after 5 minutes. You can keep waiting or try again.",
      ),
    ).toBeTruthy();

    // The retry action exists (FE-009 "retry" state).
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('does not show the timeout message once the run has ended (clock cleared at terminal states)', async () => {
    mockApiFetch
      .mockResolvedValueOnce(wireInvestigation({ status: 'running', emailsProcessed: 5 }))
      .mockResolvedValue(wireInvestigation({ status: 'completed', emailsProcessed: 310, completedAt: '2026-09-17T12:00:00.000Z' }));
    renderPage({ initialEntry: '/onboarding/investigating?investigationId=inv-1' });

    await advance(0);
    await advance(3000);
    // Run completes; even after the full timeout window the message must never appear.
    await advance(5 * 60 * 1000);
    expect(screen.queryByText('This is taking longer than expected')).toBeNull();
  });
});
