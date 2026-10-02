import { describe, expect, it, vi } from 'vitest';
import { WEB_ORIGIN } from '../config';
import { handleRequest, loadRecentDiscoveries, resolveAppUrl } from '../background/handlers';

const wireRow = (id: string, createdAt: string) => ({
  id,
  type: 'subscription',
  priority: 'medium',
  status: 'active',
  title: 'Netflix renews',
  description: 'desc',
  company: 'Netflix',
  amount: 15.49,
  currency: 'USD',
  isLocked: false,
  availableActions: ['dismiss'],
  createdAt,
});

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe('loadRecentDiscoveries', () => {
  it('maps and sorts rows newest-first, sending credentials', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json(200, {
        discoveries: [wireRow('old', '2026-10-01T00:00:00Z'), wireRow('new', '2026-10-02T00:00:00Z')],
      }),
    );
    const res = await loadRecentDiscoveries(fetchFn, 'en');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.discoveries.map((d) => d.id)).toEqual(['new', 'old']);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${WEB_ORIGIN}/discoveries?status=active&limit=5`);
    expect(init.credentials).toBe('include');
  });

  it('refreshes once on 401 and retries', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200))
      .mockResolvedValueOnce(json(200, { discoveries: [] }));
    expect(await loadRecentDiscoveries(fetchFn, 'en')).toEqual({ status: 'ok', discoveries: [] });
    expect(fetchFn.mock.calls[1][0]).toBe(`${WEB_ORIGIN}/auth/refresh`);
  });

  it('is unauthenticated when refresh fails or the retry is still 401', async () => {
    const refreshFails = vi.fn().mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));
    expect(await loadRecentDiscoveries(refreshFails, 'en')).toEqual({ status: 'unauthenticated' });

    const stillUnauthorized = vi
      .fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200))
      .mockResolvedValueOnce(json(401));
    expect(await loadRecentDiscoveries(stillUnauthorized, 'en')).toEqual({ status: 'unauthenticated' });
  });

  it('returns a generic error on 500 or network failure', async () => {
    expect(await loadRecentDiscoveries(vi.fn().mockResolvedValue(json(500)), 'en')).toEqual({ status: 'error' });
    expect(await loadRecentDiscoveries(vi.fn().mockRejectedValue(new Error('x')), 'en')).toEqual({ status: 'error' });
  });
});

describe('resolveAppUrl / handleRequest', () => {
  it('only allows app paths on the web origin', () => {
    expect(resolveAppUrl('/app/discoveries/1')).toBe(`${WEB_ORIGIN}/app/discoveries/1`);
    expect(resolveAppUrl('/upgrade')).toBe(`${WEB_ORIGIN}/upgrade`);
    expect(resolveAppUrl('//evil.com/app/x')).toBeNull();
    expect(resolveAppUrl('https://evil.com/app/x')).toBeNull();
    expect(resolveAppUrl('/auth/logout')).toBeNull();
    expect(resolveAppUrl(42)).toBeNull();
  });

  it('opens a tab for a valid OPEN_URL and rejects malformed messages', async () => {
    const openTab = vi.fn();
    const deps = { fetchFn: vi.fn(), openTab };
    expect(await handleRequest({ type: 'OPEN_URL', path: '/app/dashboard' }, deps)).toEqual({ status: 'ok' });
    expect(openTab).toHaveBeenCalledWith(`${WEB_ORIGIN}/app/dashboard`);

    openTab.mockClear();
    expect(await handleRequest({ type: 'OPEN_URL', path: '//evil.com' }, deps)).toEqual({ status: 'error' });
    expect(await handleRequest({ type: 'nope' }, deps)).toEqual({ status: 'error' });
    expect(await handleRequest(null, deps)).toEqual({ status: 'error' });
    expect(openTab).not.toHaveBeenCalled();
  });
});
