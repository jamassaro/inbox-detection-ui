import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installMockApi, resetMockState } from '../mockApi';

/**
 * The mock API is the "backend" for local dev — these tests pin its wire
 * shapes to the REAL Inbox-api contract (verified 2026-09-17) so a drift in
 * either direction is caught: if the backend contract changes and the FE
 * adapters follow, the mocks must follow too.
 */

const BASE = 'http://localhost:3000';

const get = (path: string): Promise<Response> => fetch(`${BASE}${path}`);
const send = (method: string, path: string, body?: unknown): Promise<Response> =>
  fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  resetMockState();
  installMockApi();
});

afterEach(() => {
  // No global uninstall — the interceptor is idempotent and process-wide.
});

describe('mock account + session (BE-035 surface)', () => {
  it('serves /account/me with the backend User select shape', async () => {
    const res = await get('/account/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      displayName: expect.anything(),
      plan: 'pro',
      calendarConnected: true,
      gmailComposeEnabled: true,
      locale: 'en',
    });
    // The old FE contract's fields must NOT come back — /account/me is the truth.
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('googleId');
  });

  it('serves /account/connections with gmail/calendar/compose state', async () => {
    const res = await get('/account/connections');
    const body = await res.json();
    expect(body).toEqual({
      gmail: { connected: true, email: expect.any(String) },
      calendar: { connected: true },
      gmailCompose: { enabled: true },
    });
  });

  it('disconnect endpoints flip the connection state', async () => {
    await send('DELETE', '/account/disconnect/gmail');
    const after = await (await get('/account/connections')).json();
    expect(after.gmail.connected).toBe(false);
    expect(after.gmailCompose.enabled).toBe(false);
  });
});

describe('mock billing status (BE-030)', () => {
  it('serializes Infinity limits as null — exactly like JSON.stringify(Infinity)', async () => {
    const res = await get('/billing/status');
    const body = await res.json();
    expect(body.plan).toBe('pro');
    expect(body.subscriptionStatus).toBe('active');
    expect(body.cancelAtPeriodEnd).toBe(false);
    expect(body.entitlements).toMatchObject({
      investigationEmailLimit: 2000,
      visibleDiscoveryLimit: null, // Infinity → null
      detectiveChatLimit: null, // Infinity → null
      continuousMonitoring: true,
      reminders: true,
      calendarActions: true,
      emailActions: true,
      fullDiscoveryHistory: true,
    });
  });
});

describe('mock discoveries (BE-028/029/036)', () => {
  it('returns the { discoveries, total, lockedCount, pagination } list body', async () => {
    const res = await get('/discoveries?status=active&limit=100');
    const body = await res.json();
    expect(body).toHaveProperty('discoveries');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('lockedCount');
    expect(body.pagination).toEqual({ limit: 100, offset: 0 });
    expect(body.discoveries.length).toBeGreaterThan(0);
    expect(body.discoveries.every((d: { status: string }) => d.status === 'active')).toBe(true);
  });

  it('respects the backend limit cap (100) and offset', async () => {
    const body = await (await get('/discoveries?limit=999&offset=6')).json();
    expect(body.pagination).toEqual({ limit: 100, offset: 6 });
    expect(body.discoveries.length).toBe(2); // 8 mock rows total → rows 7-8
    expect(body.total).toBe(8);
  });

  it('filters by type — the only server-side filters, like the real route', async () => {
    const body = await (await get('/discoveries?type=subscription')).json();
    expect(body.discoveries.every((d: { type: string }) => d.type === 'subscription')).toBe(true);
  });

  it('serves detail and 404s unknown ids like the backend', async () => {
    const detail = await (await get('/discoveries/dis_sub_001')).json();
    expect(detail.id).toBe('dis_sub_001');
    const missing = await get('/discoveries/nope');
    expect(missing.status).toBe(404);
  });

  it('serves evidence rows keyed by sourceEmailIds (BE-029)', async () => {
    const body = await (await get('/discoveries/dis_sub_001/evidence')).json();
    expect(body.discoveryId).toBe('dis_sub_001');
    expect(body.evidence[0]).toMatchObject({
      emailId: expect.any(String),
      sender: expect.any(String),
      subject: expect.any(String),
      date: expect.any(String),
    });
  });

  it('PATCH dismiss mutates the row (empty body, BE-036 strict)', async () => {
    const res = await send('PATCH', '/discoveries/dis_sub_001/dismiss');
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe('dismissed');
    const list = await (await get('/discoveries?status=active')).json();
    expect(list.discoveries.some((d: { id: string }) => d.id === 'dis_sub_001')).toBe(false);
  });

  it('PATCH feedback accepts only the three backend values', async () => {
    expect((await send('PATCH', '/discoveries/dis_sub_001/feedback', { feedback: 'useful' })).status).toBe(200);
    expect(
      (await send('PATCH', '/discoveries/dis_sub_001/feedback', { feedback: 'excellent' })).status,
    ).toBe(400);
  });
});

describe('mock investigations (BE-025: POST then GET polled)', () => {
  it('returns { investigationId, status } from POST and a progressing record from GET', async () => {
    const start = await (await send('POST', '/investigation')).json();
    expect(start).toMatchObject({ investigationId: expect.any(String), status: expect.any(String) });

    const record = await (await get(`/investigation/${start.investigationId}`)).json();
    expect(record).toMatchObject({
      id: start.investigationId,
      emailsDiscovered: expect.any(Number),
      emailsProcessed: expect.any(Number),
      status: expect.stringMatching(/running|queued|completed/),
    });
  });

  it('returns the already-running investigation on a second POST (max 1 active)', async () => {
    const first = await (await send('POST', '/investigation')).json();
    const second = await (await send('POST', '/investigation')).json();
    expect(second.investigationId).toBe(first.investigationId);
  });
});

describe('mock stats + chat', () => {
  it('serves GET /stats with lastScan (the badge’s real lastSync source)', async () => {
    const body = await (await get('/stats')).json();
    expect(body.lastScan).toMatchObject({ scanDate: expect.any(String) });
    expect(body).toHaveProperty('totalEvents');
    expect(body).toHaveProperty('avgConfidence');
  });

  it('answers POST /chat with a grounded response + discovery sources (BE-037)', async () => {
    const body = await (await send('POST', '/chat', { message: 'what should I look at?' })).json();
    expect(typeof body.response).toBe('string');
    expect(body.sources[0]).toMatchObject({ id: expect.any(String), type: expect.any(String) });
  });
});

describe('mock reminders (BE-011)', () => {
  it('lists pending reminders and creates one', async () => {
    const list = await (await get('/reminders')).json();
    expect(list.reminders.length).toBe(2);

    const created = await (await send('POST', '/reminders', {
      discoveryId: null,
      title: 'Chase the refund',
      remindAt: '2026-09-20T09:00:00.000Z',
    })).json();
    expect(created).toMatchObject({ id: expect.any(String), title: 'Chase the refund', status: 'pending' });

    const after = await (await get('/reminders')).json();
    expect(after.reminders.length).toBe(3);
  });

  it('PATCH reschedules and DELETE removes', async () => {
    const patched = await (await send('PATCH', '/reminders/rem_mock_001', {
      remindAt: '2026-09-19T09:00:00.000Z',
    })).json();
    expect(patched.remindAt).toBe('2026-09-19T09:00:00.000Z');

    await send('DELETE', '/reminders/rem_mock_001');
    const after = await (await get('/reminders')).json();
    expect(after.reminders.some((r: { id: string }) => r.id === 'rem_mock_001')).toBe(false);
  });
});

describe('mock surface hygiene', () => {
  it('unknown API routes 404 like the backend handler', async () => {
    const res = await get('/preferences');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Route not found' });
  });

  it('gmail draft/send round-trips the Pro compose flow (BE-013)', async () => {
    const draft = await (await send('POST', '/gmail/draft', { discoveryId: 'dis_sub_001' })).json();
    expect(draft.draftId).toEqual(expect.any(String));
    const sent = await (await send('POST', '/gmail/send', {
      agentActionId: 'act_mock_001',
      draftId: draft.draftId,
    })).json();
    expect(sent).toMatchObject({ messageId: expect.any(String), sent: true });
  });
});
