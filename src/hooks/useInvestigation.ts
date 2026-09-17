import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { getInitials } from '../lib/discoveryHelpers';
import type {
  Discovery,
  DiscoveryAction,
  DiscoveryImportance,
  DiscoveryStatus,
  DiscoveryType,
} from '../types';

/**
 * Investigation-flow hooks (FE-009): trigger an investigation, poll its
 * progress while it runs, and read back the first discoveries it produced.
 *
 * Wire contract — verified against Inbox-api BE-025/BE-028
 * (src/api/server.ts mounts `/investigation` and `/discoveries`):
 *
 * - `POST /investigation` → `{ investigationId, status? }` (idempotent while
 *   a scan is queued/running: it returns the active row instead of creating
 *   a second one). FE-009.md writes `POST /investigations`, but the backend
 *   mounts the router at `/investigation` — the live backend is the source
 *   of truth, so the singular path is used here.
 * - `GET /investigation/:id` → the Investigation row (BE-009 Prisma model):
 *   counters (`emailsProcessed`, `emailsClassified`, `subscriptionsFound`,
 *   `discoveriesCreated`, …), `status` (free String column), `errorMessage`,
 *   `startedAt`, `completedAt`.
 * - `GET /discoveries` → `{ discoveries, total, lockedCount, pagination }`
 *   (BE-028). Note FE-011's `DiscoveryListResponse { items }` predates that
 *   implementation — the live response keys are used here. Locked rows stay
 *   in the list masked (`isLocked: true`, placeholder title, null
 *   description); `lockedCount` counts every locked discovery.
 */

/** Poll cadence while the investigation is starting or running (FE-009). */
export const INVESTIGATION_POLL_INTERVAL_MS = 3000;

/** How long a starting/running investigation may poll before the UI surfaces the FE-009 timeout message. */
export const INVESTIGATION_TIMEOUT_MS = 5 * 60 * 1000;

/** Backend path of the investigation endpoints (see module docs). */
export const INVESTIGATION_PATH = '/investigation';

/** Documented values of the backend `Investigation.status` String column (BE-009). */
export type InvestigationWireStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

const WIRE_STATUSES: readonly InvestigationWireStatus[] = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
];

/** The seven FE-009 UI states the progress page must handle. */
export type InvestigationStatus =
  | 'not_started'
  | 'starting'
  | 'running'
  | 'complete'
  | 'failed'
  | 'partial'
  | 'retry';

/** The investigation categories FE-009 displays as chips. */
export type InvestigationCategory =
  | 'subscriptions'
  | 'priceChanges'
  | 'credits'
  | 'meetings'
  | 'expirations';

/** A row of `GET /investigation/:id` — mirrors the Prisma Investigation model (BE-009). */
export interface InvestigationRecord {
  id: string;
  userId: string;
  /** Free String column on the backend — always map through toInvestigationStatus(). */
  status: string;
  emailsDiscovered: number;
  emailsProcessed: number;
  emailsClassified: number;
  subscriptionsFound: number;
  offersFound: number;
  discoveriesCreated: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Maps a wire status to the FE-009 UI state. Unknown values stay
 * non-terminal (`running`) so polling continues — the 5-minute timeout is
 * the backstop for a stuck or unrecognized status, rather than guessing a
 * terminal state the backend did not report.
 */
export function toInvestigationStatus(wire: string): InvestigationStatus {
  switch (wire) {
    case 'queued':
      return 'starting';
    case 'running':
      return 'running';
    case 'completed':
      return 'complete';
    // Reserved by FE-009; BE-025 does not emit it yet, but the free-String
    // column makes accepting it cheap and keeps the UI contract intact.
    case 'partial':
      return 'partial';
    // `cancelled` ended without completing — same recovery path as failure.
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'running';
  }
}

/**
 * Progress snapshot returned by {@link useInvestigation}. `categoriesSeen`
 * carries only REAL per-run counts: the Investigation row has no per-category
 * counters except `subscriptionsFound`, and inventing numbers for the other
 * categories would violate the FE-009 trust rule ("do NOT fake progress").
 */
export interface InvestigationProgress {
  status: InvestigationStatus;
  /** Wire `emailsProcessed` — the honest "emails reviewed" count. */
  emailsReviewed: number;
  categoriesSeen: Partial<Record<InvestigationCategory, number>>;
  /** ISO-8601 completion timestamp of the run, or null while unfinished. */
  completedAt: string | null;
  /** Backend failure message, else the last fetch error's message. */
  error: string | null;
}

/** Idle snapshot for the not-started state (no investigation to poll yet). */
const NOT_STARTED: InvestigationProgress = {
  status: 'not_started',
  emailsReviewed: 0,
  categoriesSeen: {},
  completedAt: null,
  error: null,
};

function toProgress(
  id: string | null,
  row: InvestigationRecord | undefined,
  fetchError: string | null,
): InvestigationProgress {
  if (id === null) return NOT_STARTED;
  if (row === undefined) {
    // Nothing on the wire yet: 'starting' while the first read is in flight,
    // 'failed' once it has failed — the page renders both with a retry CTA.
    return {
      status: fetchError === null ? 'starting' : 'failed',
      emailsReviewed: 0,
      categoriesSeen: {},
      completedAt: null,
      error: fetchError,
    };
  }
  return {
    status: toInvestigationStatus(row.status),
    emailsReviewed: row.emailsProcessed,
    categoriesSeen:
      row.subscriptionsFound > 0 ? { subscriptions: row.subscriptionsFound } : {},
    completedAt: row.completedAt,
    error: fetchError ?? row.errorMessage ?? null,
  };
}

/**
 * Polls `GET /investigation/:id` every 3 s via TanStack Query's
 * `refetchInterval`, and ONLY while the mapped status is `starting` or
 * `running` — terminal states (`complete`, `failed`, `partial`) return
 * `false`, which stops the polling. With no id (before the trigger POST
 * resolves) the query is disabled and the status is `not_started`.
 *
 * `retry: false` matches the onboarding hooks (useGmailStatus): a failed
 * poll must surface immediately instead of three silent TanStack retries
 * stretching the wait — transient failures keep re-polling on the interval.
 */
export function useInvestigation(id: string | null): InvestigationProgress {
  const query = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => apiFetch<InvestigationRecord>(`${INVESTIGATION_PATH}/${id}`),
    enabled: id !== null,
    retry: false,
    refetchInterval: (query) => {
      const row = query.state.data as InvestigationRecord | undefined;
      if (row === undefined) {
        // A failed poll is terminal ('failed' state, retry CTA) — only a read
        // still in flight keeps the interval. Without this check a rejected
        // fetch (data stays undefined) would poll forever while the page
        // already shows the error state.
        return query.state.error ? false : INVESTIGATION_POLL_INTERVAL_MS;
      }
      const status = toInvestigationStatus(row.status);
      return status === 'starting' || status === 'running'
        ? INVESTIGATION_POLL_INTERVAL_MS
        : false;
    },
  });

  return toProgress(id, query.data, query.error?.message ?? null);
}

/** Wire body of `POST /investigation` (BE-025) — `status` only when the backend returned an already-active investigation. */
interface TriggerInvestigationWire {
  investigationId: string;
  status?: string;
}

/**
 * Normalized trigger result. FE-009 specifies `{ id, status }`; the wire key
 * is `investigationId`, normalized here so callers never touch wire naming.
 */
export interface TriggerInvestigationResult {
  id: string;
  status: InvestigationWireStatus | null;
}

const toWireStatus = (value: string | undefined): InvestigationWireStatus | null =>
  WIRE_STATUSES.includes(value as InvestigationWireStatus)
    ? (value as InvestigationWireStatus)
    : null;

/**
 * Starts an investigation (`POST /investigation`). No period override is
 * sent — the backend default lookback applies (BE-025). The backend is
 * idempotent while a scan is queued/running, but callers still guard against
 * double-POST on re-render/StrictMode double-invoke (FE-009 trust rule).
 */
export function useTriggerInvestigation() {
  return useMutation({
    mutationFn: async (): Promise<TriggerInvestigationResult> => {
      const wire = await apiFetch<TriggerInvestigationWire>(INVESTIGATION_PATH, {
        method: 'POST',
      });
      return { id: wire.investigationId, status: toWireStatus(wire.status) };
    },
  });
}

/**
 * Wire item of `GET /discoveries` (BE-028), as actually returned by the
 * backend — masked rows keep title (🔒 placeholder), company, amount,
 * priority, and status, and carry `isLocked: true` with a null description.
 */
export interface DiscoveryWire {
  id: string;
  /** Backend classification — `money|subscription|expiration|meeting_request|change`. */
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  explanation?: string | null;
  company?: string | null;
  amount?: number | null;
  currency?: string | null;
  eventDate?: string | null;
  confidence?: number;
  isLocked: boolean;
  availableActions: string[];
}

/** Wire body of `GET /discoveries` (BE-028). */
export interface DiscoveriesWire {
  discoveries: DiscoveryWire[];
  /** Total discoveries for the user (the count is NOT scoped by query filters). */
  total: number;
  lockedCount: number;
  pagination?: { limit: number; offset: number };
}

/** Page size for the results page's first-discoveries list (FE-009: "3–5 cards"). */
const RESULTS_DISCOVERY_LIMIT = 5;

/**
 * The first discoveries for the results page (`GET /discoveries?limit=5`).
 * The backend masks locked rows for Free users and reports the locked count,
 * so the response is entitlement-filtered by construction. The list is
 * deliberately NOT scoped to the investigation: BE-028's `total` counts all
 * of the user's discoveries, and "discoveries found" in the summary would
 * otherwise disagree with the number behind it.
 */
export function useInvestigationDiscoveries() {
  return useQuery({
    queryKey: ['discoveries', 'investigation-results'],
    queryFn: () =>
      apiFetch<DiscoveriesWire>(
        `/discoveries?limit=${RESULTS_DISCOVERY_LIMIT}`,
      ),
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Wire → domain adapter
//
// DiscoveryCard (FE-012) consumes the FE-011 `Discovery` domain type, while
// GET /discoveries returns BE-028 wire rows. The mapping below follows the
// backend's own category semantics (Inbox-api ai-extraction.worker.ts:
// "money maps to credit", "change" maps to price_change) — it does not
// invent finer-grained types than the backend distinguishes.
// FE-013 will want this lifted into lib/discoveryHelpers.ts.
// ---------------------------------------------------------------------------

/** Backend category → FE-011 DiscoveryType. Unknown values fall back to the action_required catch-all so the card system can never crash on a new wire value. */
const WIRE_TYPE_TO_DOMAIN: Record<string, DiscoveryType> = {
  money: 'credit',
  subscription: 'subscription',
  expiration: 'expiration',
  meeting_request: 'meeting',
  change: 'price_change',
};

/** Backend priority → FE-011 importance ('urgent' has no FE-011 equivalent — it folds into 'high'). */
const WIRE_PRIORITY_TO_IMPORTANCE: Record<string, DiscoveryImportance> = {
  urgent: 'high',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/** Backend lifecycle → FE-011 status ('expired' has no FE-011 equivalent — it renders as viewed). */
const WIRE_STATUS_TO_DOMAIN: Record<string, DiscoveryStatus> = {
  active: 'new',
  viewed: 'viewed',
  actioned: 'acted',
  dismissed: 'dismissed',
  expired: 'viewed',
};

const DISCOVERY_ACTIONS: readonly DiscoveryAction[] = [
  'remind',
  'dismiss',
  'view_source',
  'open_provider',
  'review_subscription',
  'investigate',
  'find_time',
  'track_refund',
  'ask_detective',
];

const isDiscoveryAction = (value: string): value is DiscoveryAction =>
  (DISCOVERY_ACTIONS as readonly string[]).includes(value);

/**
 * Normalizes a BE-028 wire row into the FE-011 `Discovery` the card system
 * renders. Fields the backend does not send (frequency, previousAmount,
 * companyInitials) are derived or omitted — never fabricated.
 */
export function toDiscovery(wire: DiscoveryWire): Discovery {
  return {
    id: wire.id,
    type: WIRE_TYPE_TO_DOMAIN[wire.type] ?? 'action_required',
    title: wire.title,
    summary: wire.description ?? '',
    company: wire.company ?? '',
    companyInitials: getInitials(wire.company ?? ''),
    ...(wire.amount != null && { amount: wire.amount }),
    ...(wire.currency != null && { currency: wire.currency }),
    ...(wire.eventDate != null && { date: wire.eventDate }),
    importance: WIRE_PRIORITY_TO_IMPORTANCE[wire.priority] ?? 'medium',
    status: WIRE_STATUS_TO_DOMAIN[wire.status] ?? 'new',
    locked: wire.isLocked,
    availableActions: wire.availableActions.filter(isDiscoveryAction),
    ...(wire.confidence != null && { confidence: wire.confidence }),
  };
}
