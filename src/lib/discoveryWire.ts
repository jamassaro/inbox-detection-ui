/**
 * BE-028 wire contract for GET /discoveries (Inbox-api
 * src/api/routes/discoveries.routes.ts) and the wire → FE-011 domain
 * adapter, lifted from hooks/useInvestigation.ts (FE-009) so the page and
 * the onboarding results map the API identically.
 *
 * The backend returns full Prisma Discovery rows, masked for Free users
 * (locked rows keep company/amount/priority/status, narrative fields null,
 * `availableActions: ['upgrade']`). `createdAt` feeds the FE-013 "New"
 * client-side filter, `priority` maps to the FE-011 importance.
 */
import { getInitials } from './discoveryHelpers';
import { isFormattableCurrency } from './formatting';
import type {
  CallToAction,
  Discovery,
  DiscoveryAction,
  DiscoveryImportance,
  DiscoveryStatus,
  DiscoveryType,
} from '../types';

/** One `callToActions` entry as the backend stores/sends it (`extraction.service.ts`'s `ExtractionResult.callToActions`). */
export interface CallToActionWire {
  label: string;
  url: string;
}

/** A row of GET /discoveries, as actually returned by the backend (BE-028). */
export interface DiscoveryWire {
  id: string;
  /** Backend classification — `money|subscription|expiration|meeting_request|change`. */
  type: string;
  /** Backend priority — `low|medium|high|urgent`. */
  priority: string;
  /** Backend lifecycle — `active|dismissed|actioned|expired`. */
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
  /**
   * Real merchant links extracted from the source email (`Discovery.
   * callToActions` JSONB column, verified against Inbox-api 2026-09-24) —
   * 0-3 entries, null when none matched or the row is locked. Optional here
   * (not every wire fixture in this codebase predates the field) — toDiscovery
   * normalizes an absent key to the same `null` the backend itself sends.
   */
  callToActions?: CallToActionWire[] | null;
  /** Row creation timestamp (Prisma `default(now())`) — feeds the "New" filter. */
  createdAt?: string;
}

/** Wire body of GET /discoveries (BE-028). */
export interface DiscoveriesWire {
  discoveries: DiscoveryWire[];
  /** Total discoveries for the user (NOT scoped by query filters). */
  total: number;
  /** Discoveries hidden behind the Free paywall. */
  lockedCount: number;
  pagination?: { limit: number; offset: number };
}

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

/**
 * The complete, real `availableActions` enum — verified directly against
 * Inbox-api's `discovery.service.ts` (`determineAvailableActions`) and the
 * locked-row masking in `discoveries.routes.ts`, 2026-09-24. There is no
 * broader backend enum this is a subset of; an unrecognized wire value is
 * new/unexpected, not a gap in this list.
 */
const DISCOVERY_ACTIONS: readonly DiscoveryAction[] = [
  'view_evidence',
  'create_reminder',
  'check_availability',
  'investigate',
  'dismiss',
  'open_provider',
  'upgrade',
];

const isDiscoveryAction = (value: string): value is DiscoveryAction =>
  (DISCOVERY_ACTIONS as readonly string[]).includes(value);

/** Backend cap on callToActions (`discovery.service.ts`'s `MAX_CALL_TO_ACTIONS`) — enforced again here since this is untrusted third-party content crossing a system boundary. */
const MAX_CALL_TO_ACTIONS = 3;

/**
 * Validates and caps the wire's callToActions. `url` must be a real
 * `https://` link — email-extracted content is untrusted, and an anchor
 * href is a real (if narrow) injection surface (e.g. a `javascript:` URL).
 * A malformed entry is dropped rather than rendered broken or unsafe.
 */
function toCallToActions(wire: CallToActionWire[] | null | undefined): CallToAction[] | null {
  if (!wire) return null;
  const valid = wire.filter(
    (cta): cta is CallToActionWire =>
      typeof cta?.label === 'string' &&
      cta.label.trim() !== '' &&
      typeof cta?.url === 'string' &&
      cta.url.startsWith('https://'),
  );
  return valid.length > 0 ? valid.slice(0, MAX_CALL_TO_ACTIONS) : null;
}

/**
 * Normalizes a BE-028 wire row into the FE-011 `Discovery` the card system
 * renders. Fields the backend does not send (frequency, previousAmount,
 * companyInitials) are derived or omitted — never fabricated.
 */
export function toDiscovery(wire: DiscoveryWire): Discovery {
  // Amount/currency are dropped together when currency isn't a formattable
  // ISO code (e.g. "percent" for a rate-based discovery) — an amount with
  // no valid monetary unit can't be rendered, and the wire's AI-generated
  // title/summary already describe the value in words.
  const hasMoney = wire.amount != null && !!wire.currency && isFormattableCurrency(wire.currency);

  return {
    id: wire.id,
    type: WIRE_TYPE_TO_DOMAIN[wire.type] ?? 'action_required',
    title: wire.title,
    summary: wire.description ?? '',
    company: wire.company ?? '',
    companyInitials: getInitials(wire.company ?? ''),
    ...(hasMoney && { amount: wire.amount!, currency: wire.currency! }),
    ...(wire.eventDate != null && { date: wire.eventDate }),
    ...(wire.createdAt != null && { createdAt: wire.createdAt }),
    importance: WIRE_PRIORITY_TO_IMPORTANCE[wire.priority] ?? 'medium',
    status: WIRE_STATUS_TO_DOMAIN[wire.status] ?? 'new',
    locked: wire.isLocked,
    availableActions: wire.availableActions.filter(isDiscoveryAction),
    callToActions: toCallToActions(wire.callToActions),
    ...(wire.confidence != null && { confidence: wire.confidence }),
  };
}
