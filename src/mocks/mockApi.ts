/**
 * Contract-faithful mock API for local development without a backend
 * (`VITE_USE_MOCKS=true`, FE integration task — verified against Inbox-api
 * main 1396a03 on 2026-09-17).
 *
 * Installs a synchronous `window.fetch` interceptor that serves in-memory
 * responses with the backend's REAL wire shapes:
 * - `GET /account/me` mirrors account.routes.ts's select (displayName, plan,
 *   calendarConnected, …) — there is no `/auth/me` on the backend.
 * - `GET /billing/status` returns the Pro entitlements map with JSON
 *   semantics: `Infinity` limits serialize to `null`.
 * - `POST /investigation` returns `{ investigationId, status }` and the
 *   record progresses to `completed` over a few seconds of wall time.
 * - `GET /discoveries` supports the backend's actual params (`type`,
 *   `status`, `limit`, `offset`) — there are no `search`/`importance`
 *   params; the UI filters client-side.
 *
 * Mock user is Pro so every shipped surface renders; entitlement-gated
 * (Free) states are verified against a real seeded backend instead.
 */

/** Wire row of GET /discoveries — mirrors lib/discoveryWire.ts's DiscoveryWire. */
interface MockDiscoveryWire {
  id: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  explanation: string | null;
  company: string | null;
  amount: number | null;
  currency: string | null;
  eventDate: string | null;
  confidence: number;
  isLocked: boolean;
  sourceEmailIds: string[];
  availableActions: string[];
  feedbackType: string | null;
  investigationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Wire row of GET /reminders — mirrors useReminders.ts's ReminderWire. */
interface MockReminderWire {
  id: string;
  userId: string;
  discoveryId: string | null;
  title: string;
  description: string | null;
  remindAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Wire row of GET /actions — mirrors useAgentAction.ts's AgentActionWire. */
interface MockAgentActionWire {
  id: string;
  userId: string;
  discoveryId: string | null;
  actionType: string;
  permissionLevel: 1 | 2 | 3;
  status: string;
  requestPayload: unknown;
  resultPayload: unknown;
  verificationResult: unknown;
  approvedAt: string | null;
  executedAt: string | null;
  createdAt: string;
}

interface MockState {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    photoUrl: string | null;
    plan: 'free' | 'pro';
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    calendarConnected: boolean;
    gmailComposeEnabled: boolean;
    locale: string;
    createdAt: string;
  };
  gmailConnected: boolean;
  calendarConnected: boolean;
  lastScan: { scanDate: string; emailsScanned: number; eventsFound: number; periodDays: number } | null;
  discoveries: MockDiscoveryWire[];
  reminders: MockReminderWire[];
  actions: MockAgentActionWire[];
  investigation: { id: string; startedAt: number } | null;
  draftId: string | null;
}

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysFromNow = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();

/** Initial state — rebuilt by resetMockState so tests start deterministic. */
function initialState(): MockState {
  const plan = mockPlanOverride();
  return {
    user: {
      id: 'usr_mock_001',
      email: 'detective@example.com',
      displayName: 'Mock Detective',
      photoUrl: null,
      plan,
      subscriptionStatus: plan === 'pro' ? 'active' : null,
      currentPeriodEnd: plan === 'pro' ? daysFromNow(21) : null,
      calendarConnected: true,
      gmailComposeEnabled: true,
      locale: 'en',
      createdAt: hoursAgo(24 * 30),
    },
    gmailConnected: true,
    calendarConnected: true,
    lastScan: { scanDate: hoursAgo(2), emailsScanned: 1284, eventsFound: 9, periodDays: 90 },
    discoveries: [
      {
        id: 'dis_sub_001',
        type: 'subscription',
        priority: 'high',
        status: 'active',
        title: 'Netflix premium quietly rose to $22.99/mo',
        description: 'Your Netflix plan was charged $22.99 this month, up from $15.49 last month.',
        explanation: 'Two consecutive charges differ by $7.50 with the same merchant descriptor.',
        company: 'Netflix',
        amount: 22.99,
        currency: 'USD',
        eventDate: daysFromNow(9),
        confidence: 0.96,
        isLocked: false,
        sourceEmailIds: ['189c0a1ef2a4d011'],
        availableActions: ['create_reminder', 'draft_email'],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(3),
        updatedAt: hoursAgo(3),
      },
      {
        id: 'dis_money_002',
        type: 'money',
        priority: 'urgent',
        status: 'active',
        title: 'Airline refund of $412.40 landed',
        description: 'Iberia refunded $412.40 for the cancelled MAD→JFK leg.',
        explanation: 'Refund confirmation with amount and booking reference detected.',
        company: 'Iberia',
        amount: 412.4,
        currency: 'EUR',
        eventDate: daysFromNow(-1),
        confidence: 0.98,
        isLocked: false,
        sourceEmailIds: ['189c0b7712a4d0f4'],
        availableActions: ['create_reminder'],
        feedbackType: 'useful',
        investigationId: null,
        createdAt: hoursAgo(5),
        updatedAt: hoursAgo(5),
      },
      {
        id: 'dis_exp_003',
        type: 'expiration',
        priority: 'high',
        status: 'active',
        title: 'Domain renewal tomorrow — auto-renews at $79',
        description: 'kempt.app domain expires tomorrow; auto-renew will charge $79.',
        explanation: 'Expiration notice with explicit date and renewal price.',
        company: 'Namecheap',
        amount: 79,
        currency: 'USD',
        eventDate: daysFromNow(1),
        confidence: 0.94,
        isLocked: false,
        sourceEmailIds: ['189c0c2299a4d0a2'],
        availableActions: ['create_reminder', 'draft_email'],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(8),
        updatedAt: hoursAgo(8),
      },
      {
        id: 'dis_sub_004',
        type: 'subscription',
        priority: 'medium',
        status: 'active',
        title: 'Spotify Duo renews in 12 days',
        description: 'Spotify Duo will renew at $16.99 on the 29th.',
        explanation: 'Upcoming renewal notice with recurring amount.',
        company: 'Spotify',
        amount: 16.99,
        currency: 'USD',
        eventDate: daysFromNow(12),
        confidence: 0.91,
        isLocked: false,
        sourceEmailIds: ['189c0d3312a4d0b7'],
        availableActions: ['create_reminder'],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(26),
        updatedAt: hoursAgo(26),
      },
      {
        id: 'dis_chg_005',
        type: 'change',
        priority: 'medium',
        status: 'active',
        title: 'iCloud+ storage tier changed to 2TB',
        description: 'Your iCloud plan changed from 200GB to 2TB ($9.99/mo).',
        explanation: 'Plan-change confirmation from Apple with new price.',
        company: 'Apple',
        amount: 9.99,
        currency: 'USD',
        eventDate: daysFromNow(-4),
        confidence: 0.89,
        isLocked: false,
        sourceEmailIds: ['189c0e4412a4d0c3'],
        availableActions: ['create_reminder'],
        feedbackType: 'not_useful',
        investigationId: null,
        createdAt: hoursAgo(50),
        updatedAt: hoursAgo(50),
      },
      {
        id: 'dis_meet_006',
        type: 'meeting_request',
        priority: 'low',
        status: 'active',
        title: 'Coffee with Ana — proposed Thursday 10:00',
        description: 'Ana proposed Thursday 10:00 at Café Central.',
        explanation: 'Meeting proposal with concrete time and place.',
        company: null,
        amount: null,
        currency: null,
        eventDate: daysFromNow(4),
        confidence: 0.82,
        isLocked: false,
        sourceEmailIds: ['189c0f5512a4d0d9'],
        availableActions: ['schedule_meeting'],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(74),
        updatedAt: hoursAgo(74),
      },
      {
        id: 'dis_exp_007',
        type: 'expiration',
        priority: 'urgent',
        status: 'active',
        title: 'Passport expires in 45 days',
        description: 'Your passport expires soon; several booked trips extend past it.',
        explanation: 'Government expiration notice matched against travel bookings.',
        company: 'GovTravel',
        amount: null,
        currency: null,
        eventDate: daysFromNow(45),
        confidence: 0.93,
        isLocked: false,
        sourceEmailIds: ['189c106612a4d0e1'],
        availableActions: ['create_reminder'],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(98),
        updatedAt: hoursAgo(98),
      },
      {
        id: 'dis_sub_008',
        type: 'subscription',
        priority: 'low',
        status: 'dismissed',
        title: 'Trial ends — PromptClub Pro',
        description: 'Your PromptClub trial ends this week ($12/mo after).',
        explanation: 'Trial-end notice.',
        company: 'PromptClub',
        amount: 12,
        currency: 'USD',
        eventDate: daysFromNow(3),
        confidence: 0.87,
        isLocked: false,
        sourceEmailIds: ['189c117712a4d0f0'],
        availableActions: [],
        feedbackType: null,
        investigationId: null,
        createdAt: hoursAgo(120),
        updatedAt: hoursAgo(100),
      },
    ],
    reminders: [
      {
        id: 'rem_mock_001',
        userId: 'usr_mock_001',
        discoveryId: 'dis_exp_003',
        title: 'Renew kempt.app before it lapses',
        description: null,
        remindAt: daysFromNow(1),
        status: 'pending',
        createdAt: hoursAgo(7),
        updatedAt: hoursAgo(7),
      },
      {
        id: 'rem_mock_002',
        userId: 'usr_mock_001',
        discoveryId: null,
        title: 'Call the bank about the refund',
        description: 'Reference the Iberia refund.',
        remindAt: daysFromNow(2),
        status: 'pending',
        createdAt: hoursAgo(20),
        updatedAt: hoursAgo(20),
      },
    ],
    actions: [
      {
        id: 'act_mock_001',
        userId: 'usr_mock_001',
        discoveryId: 'dis_exp_003',
        actionType: 'draft_email',
        permissionLevel: 2,
        status: 'awaiting_approval',
        requestPayload: {
          to: 'support@namecheap.com',
          subject: 'Renewal question for kempt.app',
        },
        resultPayload: null,
        verificationResult: null,
        approvedAt: null,
        executedAt: null,
        createdAt: hoursAgo(1),
      },
    ],
    investigation: null,
    draftId: null,
  };
}

let state: MockState = initialState();

/** Test hook: restores pristine mock data. Not part of the app surface. */
export function resetMockState(): void {
  state = initialState();
}

/**
 * Dev hook: `localStorage['mock:plan'] = 'free' | 'pro'` (default pro) picks
 * the seeded plan so Free-gated surfaces can be exercised without a rebuild.
 */
export function mockPlanOverride(): 'free' | 'pro' {
  try {
    return localStorage.getItem('mock:plan') === 'free' ? 'free' : 'pro';
  } catch {
    return 'pro';
  }
}

/** Small delay so loading/skeleton states are real in mock mode too. */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Pro entitlements exactly as the backend serializes them — Infinity → null. */
function proEntitlements(): Record<string, unknown> {
  return {
    investigationEmailLimit: 2000,
    visibleDiscoveryLimit: null,
    continuousMonitoring: true,
    reminders: true,
    calendarActions: true,
    emailActions: true,
    detectiveChatLimit: null,
    historicalComparison: true,
    dailyBriefing: true,
    fullDiscoveryHistory: true,
  };
}

/** Free entitlements exactly as the backend serializes them — Infinity → null. */
function freeEntitlements(): Record<string, unknown> {
  return {
    investigationEmailLimit: 500,
    visibleDiscoveryLimit: null, // backend Infinity → null over JSON
    continuousMonitoring: false,
    reminders: false,
    calendarActions: false,
    emailActions: false,
    detectiveChatLimit: 5,
    historicalComparison: false,
    dailyBriefing: false,
    fullDiscoveryHistory: false,
  };
}

/** GET /billing/status body (BE-030). */
function billingStatus() {
  return {
    plan: state.user.plan,
    subscriptionStatus: state.user.subscriptionStatus,
    currentPeriodEnd: state.user.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    entitlements: state.user.plan === 'pro' ? proEntitlements() : freeEntitlements(),
  };
}

/** GET /account/connections body (BE-035). */
function connections() {
  return {
    gmail: { connected: state.gmailConnected, email: state.user.email },
    calendar: { connected: state.calendarConnected },
    gmailCompose: { enabled: state.gmailConnected },
  };
}

/** Applies the backend's list contract to the mock rows (BE-028). */
function discoveryList(url: URL) {
  const type = url.searchParams.get('type') ?? '';
  const status = url.searchParams.get('status');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '', 10) || 20, 0), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '', 10) || 0, 0);

  const filtered = state.discoveries.filter(
    (d) =>
      (type === '' || d.type === type) &&
      (status === '' || status === null || d.status === status),
  );
  // BE-028 entitlement masking: Free sees only the first visibleDiscoveryLimit
  // rows of the filtered list; the remainder surfaces as lockedCount.
  const visibleLimit = state.user.plan === 'pro' ? Infinity : 3;
  const visible = filtered.slice(0, visibleLimit);
  return {
    discoveries: visible.slice(offset, offset + limit),
    total: filtered.length,
    lockedCount: Math.max(0, filtered.length - visible.length),
    pagination: { limit, offset },
  };
}

/** The mock investigation reaches `completed` after ~4s of wall time. */
function investigationRecord() {
  const inv = state.investigation;
  if (!inv) return null;
  const elapsed = Date.now() - inv.startedAt;
  const done = elapsed > 4000;
  const emails = 1284;
  const scale = Math.min(Math.max(elapsed / 4000, 0.05), 1);
  return {
    id: inv.id,
    userId: state.user.id,
    status: done ? 'completed' : 'running',
    emailsDiscovered: emails,
    emailsProcessed: Math.round(emails * scale),
    emailsClassified: Math.round(emails * scale),
    subscriptionsFound: done ? 4 : Math.round(4 * scale),
    offersFound: done ? 5 : Math.round(5 * scale),
    discoveriesCreated: done ? 7 : Math.round(7 * scale),
    errorMessage: null,
    startedAt: new Date(inv.startedAt).toISOString(),
  };
}

/**
 * Route table: `(method, pathname)` matchers over the mounted backend
 * prefixes. Returns null for non-API fetches (passthrough).
 */
async function handle(method: string, pathname: string, url: URL, body: string | null): Promise<Response | null> {
  const API_PREFIXES = [
    '/account', '/auth', '/stats', '/discoveries', '/investigation', '/billing',
    '/reminders', '/calendar', '/gmail', '/actions', '/chat', '/preferences',
  ];
  if (!API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  await sleep(40);
  const parsed: unknown = body ? JSON.parse(body) : null;
  const obj = (parsed ?? {}) as Record<string, unknown>;

  // --- Account & session (BE-035; there is no /auth/me) ---
  if (method === 'GET' && pathname === '/account/me') return json(state.user);
  if (method === 'GET' && pathname === '/account/connections') return json(connections());
  if (method === 'DELETE' && pathname === '/account/disconnect/gmail') {
    state.gmailConnected = false;
    return json({ success: true });
  }
  if (method === 'DELETE' && pathname === '/account/disconnect/calendar') {
    state.calendarConnected = false;
    return json({ success: true });
  }
  if (method === 'POST' && pathname === '/auth/logout') return json({ success: true });

  // --- Stats (BE-045; real source of the badge's lastSync) ---
  if (method === 'GET' && pathname === '/stats') {
    return json({
      totalEvents: 9,
      activeOffers: 7,
      expiredOffers: 2,
      expiringToday: 1,
      avgConfidence: 0.92,
      lastScan: state.lastScan,
    });
  }

  // --- Discoveries (BE-028/029/036) ---
  if (method === 'GET' && pathname === '/discoveries') return json(discoveryList(url));
  const discoveryMatch = pathname.match(/^\/discoveries\/([^/]+)(\/(dismiss|feedback|evidence))?$/);
  if (discoveryMatch) {
    const id = discoveryMatch[1];
    const sub = discoveryMatch[3];
    const row = state.discoveries.find((d) => d.id === id);
    if (method === 'GET' && !sub) {
      if (!row) return json({ error: 'Discovery not found' }, 404);
      return json(row);
    }
    if (method === 'GET' && sub === 'evidence') {
      if (!row) return json({ error: 'Discovery not found' }, 404);
      return json({
        discoveryId: row.id,
        explanation: row.explanation,
        evidence: row.sourceEmailIds.map((emailId) => ({
          emailId,
          sender: `${row.company ?? 'someone'} <no-reply@example.com>`,
          subject: row.title,
          date: row.createdAt,
          snippet: row.description,
          company: row.company,
        })),
      });
    }
    if (method === 'PATCH' && sub === 'dismiss') {
      if (!row) return json({ error: 'Not found' }, 404);
      row.status = 'dismissed';
      row.updatedAt = new Date().toISOString();
      return json(row);
    }
    if (method === 'PATCH' && sub === 'feedback') {
      const feedback = typeof obj.feedback === 'string' ? obj.feedback : null;
      if (feedback !== 'useful' && feedback !== 'not_useful' && feedback !== 'never_this_type') {
        return json({ error: 'validation_error' }, 400);
      }
      if (!row) return json({ error: 'Not found' }, 404);
      row.feedbackType = feedback;
      row.updatedAt = new Date().toISOString();
      return json({ success: true });
    }
  }

  // --- Investigations (BE-025; POST then GET polled) ---
  if (method === 'POST' && pathname === '/investigation') {
    if (state.investigation && Date.now() - state.investigation.startedAt <= 4000) {
      return json({ investigationId: state.investigation.id, status: 'running' });
    }
    state.investigation = { id: `inv_${Date.now()}`, startedAt: Date.now() };
    state.lastScan = {
      scanDate: new Date().toISOString(),
      emailsScanned: 1284,
      eventsFound: 9,
      periodDays: 90,
    };
    return json({ investigationId: state.investigation.id, status: 'queued' });
  }
  if (method === 'GET' && pathname.startsWith('/investigation/')) {
    return json(investigationRecord());
  }

  // --- Billing (BE-030) ---
  if (method === 'GET' && pathname === '/billing/status') return json(billingStatus());
  if (method === 'POST' && pathname === '/billing/checkout') {
    return json({ checkoutUrl: 'https://checkout.stripe.test/mock-session' });
  }
  if (method === 'POST' && pathname === '/billing/portal') {
    return json({ portalUrl: 'https://billing.stripe.test/mock-portal' });
  }

  // --- Reminders (BE-011) ---
  if (method === 'GET' && pathname === '/reminders') {
    return json({ reminders: state.reminders.filter((r) => r.status === 'pending') });
  }
  if (method === 'POST' && pathname === '/reminders') {
    const reminder: MockReminderWire = {
      id: `rem_${Date.now()}`,
      userId: state.user.id,
      discoveryId: typeof obj.discoveryId === 'string' ? obj.discoveryId : null,
      title: String(obj.title ?? 'Reminder'),
      description: typeof obj.description === 'string' ? obj.description : null,
      remindAt: String(obj.remindAt ?? daysFromNow(1)),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.reminders.push(reminder);
    return json({ id: reminder.id, title: reminder.title, remindAt: reminder.remindAt, status: reminder.status });
  }
  const reminderMatch = pathname.match(/^\/reminders\/([^/]+)$/);
  if (reminderMatch) {
    const idx = state.reminders.findIndex((r) => r.id === reminderMatch[1]);
    if (method === 'PATCH') {
      if (idx === -1) return json({ error: 'Not found' }, 404);
      if (typeof obj.remindAt === 'string') state.reminders[idx].remindAt = obj.remindAt;
      state.reminders[idx].updatedAt = new Date().toISOString();
      return json(state.reminders[idx]);
    }
    if (method === 'DELETE') {
      if (idx !== -1) state.reminders.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
  }

  // --- Calendar (BE-019/021) ---
  if (method === 'GET' && pathname === '/calendar/availability') {
    return json({ busy: [{ start: daysFromNow(1), end: daysFromNow(1.02) }] });
  }
  if (method === 'POST' && pathname === '/calendar/events') {
    return json({ eventId: `evt_${Date.now()}` });
  }

  // --- Gmail actions (BE-013) ---
  if (method === 'POST' && pathname === '/gmail/draft') {
    state.draftId = `draft_${Date.now()}`;
    return json({ draftId: state.draftId });
  }
  if (method === 'POST' && pathname === '/gmail/send') {
    return json({ messageId: `msg_${Date.now()}`, sent: true });
  }

  // --- Agent actions (BE-011) ---
  if (method === 'GET' && pathname === '/actions') {
    const status = url.searchParams.get('status');
    return json({ actions: state.actions.filter((a) => !status || a.status === status) });
  }
  const actionMatch = pathname.match(/^\/actions\/([^/]+)\/(approve|reject)$/);
  if (method === 'POST' && actionMatch) {
    const action = state.actions.find((a) => a.id === actionMatch[1]);
    if (!action) return json({ error: 'Not found' }, 404);
    if (actionMatch[2] === 'approve') {
      action.status = 'approved';
      action.approvedAt = new Date().toISOString();
      return json(action);
    }
    action.status = 'rejected';
    return new Response(null, { status: 204 });
  }

  // --- Detective chat (BE-037) ---
  if (method === 'POST' && pathname === '/chat') {
    const first = state.discoveries[0];
    return json({
      response:
        `Based on your inbox: your highest-priority item is "${first.title}". ` +
        'I also see a high-urgency expiration and a Netflix price change worth reviewing.',
      sources: state.discoveries.slice(0, 2).map((d) => ({ id: d.id, title: d.title, type: d.type })),
    });
  }

  // Unknown API route — mirror the backend's 404 handler.
  return json({ error: 'Route not found' }, 404);
}

let installed = false;

/**
 * Installs the interceptor. Synchronous and idempotent; call before React
 * mounts so the first session check is already intercepted.
 */
export function installMockApi(): void {
  if (installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, 'http://mock.local');
    const method = (init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();

    const mocked = await handle(method, url.pathname, url, typeof init?.body === 'string' ? init.body : null);
    if (mocked) return mocked;

    // Not an API path (dev assets, HMR, …) — pass through untouched.
    return originalFetch(input, init);
  };
}
