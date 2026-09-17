import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGmailUrl,
  discoveryDetailPath,
  discoveryEvidencePath,
  toEvidenceItem,
  useDiscovery,
  useDiscoverySource,
} from '../useDiscovery';
import { apiFetch } from '../../lib/apiClient';
import type { DiscoveryWire } from '../../lib/discoveryWire';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const detailWire = (overrides: Partial<DiscoveryWire> = {}): DiscoveryWire => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'Netflix renews at $15.49',
  description: 'Standard plan, monthly renewal.',
  company: 'Netflix',
  amount: 15.49,
  currency: 'USD',
  eventDate: '2026-10-01',
  priority: 'high',
  status: 'active',
  isLocked: false,
  availableActions: ['review_subscription', 'dismiss'],
  confidence: 0.9,
  createdAt: '2026-09-17T11:00:00.000Z',
  ...overrides,
});

const evidenceWire = () => ({
  discoveryId: 'disc-1',
  explanation: 'Flagged because the renewal date is within 7 days.',
  evidence: [
    {
      emailId: 'msg-1935c0a1',
      sender: 'Netflix <info@netflix.com>',
      subject: 'Your renewal is coming up',
      date: '2026-09-10T12:00:00.000Z',
      snippet: 'Your Standard plan renews on October 1 for $15.49.',
      company: 'Netflix',
    },
  ],
});

const renderQueryHook = <T,>(hook: () => T) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
};

describe('discovery detail paths', () => {
  it('builds the BE-028 detail and BE-029 evidence paths', () => {
    expect(discoveryDetailPath('disc-1')).toBe('/discoveries/disc-1');
    expect(discoveryEvidencePath('disc-1')).toBe('/discoveries/disc-1/evidence');
  });

  it('derives the Gmail deep link from the message id', () => {
    expect(buildGmailUrl('msg-1935c0a1')).toBe(
      'https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1',
    );
  });
});

describe('toEvidenceItem', () => {
  it('maps the wire row onto the FE-011 evidence shape, deriving gmailUrl', () => {
    const item = toEvidenceItem(evidenceWire().evidence[0]);
    expect(item).toEqual({
      id: 'msg-1935c0a1',
      sender: 'Netflix <info@netflix.com>',
      subject: 'Your renewal is coming up',
      date: '2026-09-10T12:00:00.000Z',
      excerpt: 'Your Standard plan renews on October 1 for $15.49.',
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1',
    });
  });

  it('renders a null snippet as an empty excerpt', () => {
    const item = toEvidenceItem({ ...evidenceWire().evidence[0], snippet: null });
    expect(item.excerpt).toBe('');
  });
});

describe('useDiscovery', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      await vi.useRealTimers();
    });
  });

  it('fetches GET /discoveries/:id and maps through toDiscovery', async () => {
    mockApiFetch.mockResolvedValue(detailWire());
    const { result } = renderQueryHook(() => useDiscovery('disc-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1');
    expect(result.current.data?.type).toBe('subscription');
    expect(result.current.data?.summary).toBe('Standard plan, monthly renewal.');
    expect(result.current.data?.companyInitials).toBe('N');
  });

  it('does not fetch when the id is empty', () => {
    renderQueryHook(() => useDiscovery(''));
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe('useDiscoverySource', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      await vi.useRealTimers();
    });
  });

  it('fetches GET /discoveries/:id/evidence lazily when enabled', async () => {
    mockApiFetch.mockResolvedValue(evidenceWire());
    const { result } = renderQueryHook(() => useDiscoverySource('disc-1', true));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith('/discoveries/disc-1/evidence');
    expect(result.current.data?.explanation).toBe(
      'Flagged because the renewal date is within 7 days.',
    );
    expect(result.current.data?.emails).toHaveLength(1);
    expect(result.current.data?.emails[0].gmailUrl).toBe(
      'https://mail.google.com/mail/u/0/#inbox/msg-1935c0a1',
    );
  });

  it('stays idle while the drawer is closed (enabled=false)', () => {
    renderQueryHook(() => useDiscoverySource('disc-1', false));
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
