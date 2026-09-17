import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  AGENT_ACTIONS_QUERY_KEY,
  selectLatestDiscoveryAction,
  useAgentActions,
  useApproveAgentAction,
  useRejectAgentAction,
} from '../useAgentAction';
import type { AgentActionWire } from '../useAgentAction';
import { apiFetch } from '../../lib/apiClient';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const wireAction = (overrides: Partial<AgentActionWire> = {}): AgentActionWire => ({
  id: 'act_1',
  userId: 'usr_1',
  discoveryId: 'disc_1',
  actionType: 'create_calendar_event',
  permissionLevel: 2,
  status: 'proposed',
  requestPayload: { title: 'Meeting', start: '2026-09-18T15:00:00.000Z', end: '2026-09-18T16:00:00.000Z' },
  resultPayload: null,
  verificationResult: null,
  approvedAt: null,
  executedAt: null,
  verifiedAt: null,
  failureReason: null,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
  ...overrides,
});

describe('useAgentActions', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('lists all actions when no status filter is given', async () => {
    mockApiFetch.mockResolvedValueOnce({ actions: [wireAction()] });

    const { result } = renderHook(() => useAgentActions(), { wrapper });

    await waitFor(() => expect(result.current.data?.actions).toHaveLength(1));
    expect(mockApiFetch).toHaveBeenCalledWith('/actions');
  });

  it('passes the route-supported status filter through', async () => {
    mockApiFetch.mockResolvedValueOnce({ actions: [] });

    const { result } = renderHook(() => useAgentActions('proposed'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/actions?status=proposed');
  });
});

describe('selectLatestDiscoveryAction', () => {
  it('returns the first action matching type and discovery (list is createdAt-desc)', () => {
    const older = wireAction({ id: 'old', createdAt: '2026-09-16T00:00:00.000Z' });
    const newer = wireAction({ id: 'new', createdAt: '2026-09-17T00:00:00.000Z' });
    expect(selectLatestDiscoveryAction([older, newer], 'disc_1', 'create_calendar_event')).toBe(older);
  });

  it('ignores actions of other types or discoveries', () => {
    const other = wireAction({ id: 'other', actionType: 'draft_email' });
    const otherDiscovery = wireAction({ id: 'other-disc', discoveryId: 'disc_2' });
    expect(selectLatestDiscoveryAction([other, otherDiscovery], 'disc_1', 'create_calendar_event')).toBeUndefined();
  });
});

describe('useApproveAgentAction', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
    queryClient.setQueryData(AGENT_ACTIONS_QUERY_KEY, { actions: [wireAction()] });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('POSTs the approve route and invalidates the actions cache', async () => {
    mockApiFetch.mockResolvedValueOnce(wireAction({ status: 'approved' }));

    const { result } = renderHook(() => useApproveAgentAction(), { wrapper });
    await act(() => result.current.mutateAsync('act_1'));

    expect(mockApiFetch).toHaveBeenCalledWith('/actions/act_1/approve', { method: 'POST' });
    await waitFor(() => expect(queryClient.getQueryState(AGENT_ACTIONS_QUERY_KEY)?.isInvalidated).toBe(true));
  });
});

describe('useRejectAgentAction', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  it('POSTs the reject route', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useRejectAgentAction(), { wrapper });
    await act(() => result.current.mutateAsync('act_1'));

    expect(mockApiFetch).toHaveBeenCalledWith('/actions/act_1/reject', { method: 'POST' });
  });
});
