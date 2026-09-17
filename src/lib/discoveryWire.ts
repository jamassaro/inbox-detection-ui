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
import type {
  Discovery,
  DiscoveryAction,
  DiscoveryImportance,
  DiscoveryStatus,
  DiscoveryType,
} from '../types';

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
    ...(wire.createdAt != null && { createdAt: wire.createdAt }),
    importance: WIRE_PRIORITY_TO_IMPORTANCE[wire.priority] ?? 'medium',
    status: WIRE_STATUS_TO_DOMAIN[wire.status] ?? 'new',
    locked: wire.isLocked,
    availableActions: wire.availableActions.filter(isDiscoveryAction),
    ...(wire.confidence != null && { confidence: wire.confidence }),
  };
}
