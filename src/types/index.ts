/**
 * Canonical Discovery domain types for Inbox Detective.
 *
 * Source of truth: AGENTS.md "The Discovery Object" and
 * docs/backlog/frontend/FE-011.md. The string values below mirror the
 * backend's enum values exactly — they are wire values from the API and must
 * never be rendered directly: always map them through the translation-key
 * helpers in src/lib/discoveryHelpers.ts.
 */

/**
 * Domain classification of a Discovery. Mirrors the backend
 * `DiscoveryType` enum (Prisma) — see Inbox-api `prisma/schema.prisma`.
 */
export type DiscoveryType =
  | 'subscription'
  | 'renewal'
  | 'trial_expiration'
  | 'price_change'
  | 'bill_change'
  | 'credit'
  | 'refund'
  | 'reward'
  | 'expiration'
  | 'cashback'
  | 'meeting'
  | 'action_required';

/** Discovery lifecycle state. Mirrors the backend `DiscoveryStatus` enum. */
export type DiscoveryStatus = 'new' | 'viewed' | 'acted' | 'dismissed';

/** How urgently a Discovery needs user attention. */
export type DiscoveryImportance = 'high' | 'medium' | 'low';

/**
 * Action available on a Discovery. Mirrors the backend
 * `DiscoveryAction` enum (Prisma) — see Inbox-api `prisma/schema.prisma`.
 */
export type DiscoveryAction =
  | 'remind'
  | 'dismiss'
  | 'view_source'
  | 'open_provider'
  | 'review_subscription'
  | 'investigate'
  | 'find_time'
  | 'track_refund'
  | 'ask_detective';

/**
 * The primary domain object: a single actionable insight extracted
 * from the user's email by the backend pipeline.
 */
export interface Discovery {
  /** Backend-generated unique identifier. */
  id: string;
  /** Domain classification (backend enum value) — map through getDiscoveryTypeKey(). */
  type: DiscoveryType;
  /** User-facing title. AI-generated — render as-is, never through t(). */
  title: string;
  /** One-paragraph summary. AI-generated — render as-is, never through t(). */
  summary: string;
  /** Merchant or sender company name. Proper noun — never translate. */
  company: string;
  /** Initials derived from `company` (see getInitials in discoveryHelpers). */
  companyInitials: string;
  /** Monetary amount attached to the Discovery, when known. */
  amount?: number;
  /** ISO currency code for `amount`, e.g. 'USD' — separate from UI locale. */
  currency?: string;
  /** Billing cadence, when known — map through billing.frequency.* keys. */
  frequency?: 'monthly' | 'annual' | 'weekly' | 'one_time';
  /** ISO-8601 date of the underlying event, when known. */
  date?: string;
  /** Amount before a price or bill change, when known. */
  previousAmount?: number;
  /** How urgently the Discovery needs attention. */
  importance: DiscoveryImportance;
  /** Lifecycle state (backend enum value). */
  status: DiscoveryStatus;
  /**
   * Backend entitlement flag: free users receive `locked: true` on
   * Discoveries beyond their visible limit. Never calculated client-side.
   */
  locked: boolean;
  /** Actions the UI may offer for this Discovery — map through getDiscoveryActionKey(). */
  availableActions: DiscoveryAction[];
  /** Backend classifier confidence in [0, 1], when known. */
  confidence?: number;
}

/** Paginated list response for the Discovery feed. */
export interface DiscoveryListResponse {
  items: Discovery[];
  /** Number of items hidden behind the paywall. */
  lockedCount: number;
  /** Total number of Discoveries for the user. */
  total: number;
}

/** Sanitized source-email evidence attached to a Discovery. */
export interface DiscoverySourceEvidence {
  id: string;
  subject: string;
  sender: string;
  /** ISO-8601 date the source email was received. */
  date: string;
  /** Text excerpt from the source email — render sanitized. */
  excerpt: string;
  /** Deep link to the original message in Gmail. */
  gmailUrl: string;
}

/*
 * Legacy prototype types (FE-011 retains them so the existing offers pages
 * keep compiling; removed when mock data is removed, post-V1 cleanup).
 */
export interface Offer {
  id: string;
  companyName: string;
  companyInitials: string;
  discount: string;
  description: string;
  status?: 'ending-soon' | 'new' | 'restart';
  statusText?: string;
  date: string;
  featured?: boolean;
  code?: string;
}

export type FilterType = 'all' | 'ending-soon' | 'new' | 'saved';

/**
 * Authenticated user, as returned by `GET /auth/me`. Mirrors the backend
 * session user — see Inbox-api. Never stored in localStorage; the session
 * lives in an httpOnly cookie.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  googleId: string;
  /** Set when the user has completed Gmail OAuth (drives AuthCallbackPage routing). */
  gmailConnected?: boolean;
}
