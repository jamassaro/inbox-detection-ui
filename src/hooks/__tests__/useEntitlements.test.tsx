import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthProvider';
import { EntitlementProvider } from '../../contexts/EntitlementProvider';
import { useEntitlements } from '../useEntitlements';
import { apiFetch } from '../../lib/apiClient';
import type { BillingStatusWire, Entitlements, User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

/** Wire body of GET /billing/status (BE-030) — verified against Inbox-api src. */
const FREE_STATUS: BillingStatusWire = {
  plan: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 500,
    visibleDiscoveryLimit: 5,
    continuousMonitoring: false,
    reminders: false,
    calendarActions: false,
    emailActions: false,
    detectiveChatLimit: 3,
    historicalComparison: false,
    dailyBriefing: false,
    fullDiscoveryHistory: false,
  },
};

const PRO_STATUS: BillingStatusWire = {
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-17T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  entitlements: {
    investigationEmailLimit: 2000,
    visibleDiscoveryLimit: null, // Infinity serializes to null over JSON
    continuousMonitoring: true,
    reminders: true,
    calendarActions: true,
    emailActions: true,
    detectiveChatLimit: null,
    historicalComparison: true,
    dailyBriefing: true,
    fullDiscoveryHistory: true,
  },
};

/** What mapBillingStatusToEntitlements yields for the wire fixtures above. */
const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  visibleDiscoveries: 5,
  continuousMonitoring: false,
  reminders: false,
  calendarActions: false,
  emailActions: false,
  dailyBriefing: false,
  chatQuestionsRemaining: 3,
};

const PRO_ENTITLEMENTS: Entitlements = {
  plan: 'pro',
  visibleDiscoveries: null,
  continuousMonitoring: true,
  reminders: true,
  calendarActions: true,
  emailActions: true,
  dailyBriefing: true,
  chatQuestionsRemaining: null,
};

describe('useEntitlements', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <EntitlementProvider>{children}</EntitlementProvider>
      </QueryClientProvider>
    </AuthProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('exposes Free-plan convenience booleans', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(FREE_STATUS); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.entitlements).toEqual(FREE_ENTITLEMENTS));

    expect(result.current.plan).toBe('free');
    expect(result.current.isPro).toBe(false);
    expect(result.current.isFree).toBe(true);
    expect(result.current.canUseReminders).toBe(false);
    expect(result.current.canUseCalendar).toBe(false);
    expect(result.current.canUseEmailActions).toBe(false);
    expect(result.current.canUseDailyBriefing).toBe(false);
    expect(result.current.canUseContinuousMonitoring).toBe(false);
    expect(result.current.chatQuestionsRemaining).toBe(3);
  });

  it('exposes Pro-plan convenience booleans with unlimited chat', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(PRO_STATUS); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.entitlements).toEqual(PRO_ENTITLEMENTS));

    expect(result.current.plan).toBe('pro');
    expect(result.current.isPro).toBe(true);
    expect(result.current.isFree).toBe(false);
    expect(result.current.canUseReminders).toBe(true);
    expect(result.current.canUseCalendar).toBe(true);
    expect(result.current.canUseEmailActions).toBe(true);
    expect(result.current.canUseDailyBriefing).toBe(true);
    expect(result.current.canUseContinuousMonitoring).toBe(true);
    expect(result.current.chatQuestionsRemaining).toBeNull();
  });

  it('hasFeature() grants every feature when the plan is Pro even if a flag is off', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce({ ...PRO_STATUS, entitlements: { ...PRO_STATUS.entitlements, reminders: false } }); // /billing/status

    const { result } = renderHook(() => useEntitlements(), { wrapper });
    await waitFor(() => expect(result.current.isPro).toBe(true));

    expect(result.current.hasFeature('reminders')).toBe(true);
    expect(result.current.hasFeature('calendarActions')).toBe(true);
  });

  it('throws when used outside an EntitlementProvider', () => {
    expect(() => renderHook(() => useEntitlements())).toThrow(
      'useEntitlements must be used within an EntitlementProvider',
    );
  });
});
