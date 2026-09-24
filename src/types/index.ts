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
 * Action available on a Discovery — the complete, real set of string values
 * `discovery.service.ts`'s `determineAvailableActions` (and the locked-row
 * masking in `discoveries.routes.ts`) can ever emit, verified directly
 * against the backend source 2026-09-24. There is no richer enum on the
 * backend to "mirror" — this IS the whole set.
 */
export type DiscoveryAction =
  | 'view_evidence'
  | 'create_reminder'
  | 'check_availability'
  | 'investigate'
  | 'dismiss'
  | 'open_provider'
  | 'upgrade';

/** A real merchant link extracted from the source email's own HTML — never AI-invented (backend `extraction.service.ts`). */
export interface CallToAction {
  /** Actual anchor text from the email, e.g. "Shop the sale" — display as-is, never translate/paraphrase. */
  label: string;
  /** Real https:// URL from the email. Untrusted third-party content: open with target="_blank" rel="noopener noreferrer", never auto-navigate or pre-fetch. */
  url: string;
}

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
  /** When the backend row was created (BE-028), when provided — feeds recency filters. */
  createdAt?: string;
  /**
   * Backend entitlement flag: free users receive `locked: true` on
   * Discoveries beyond their visible limit. Never calculated client-side.
   */
  locked: boolean;
  /** Actions the UI may offer for this Discovery — map through getDiscoveryActionKey(). */
  availableActions: DiscoveryAction[];
  /**
   * Real merchant links from the source email — 0-3 entries, present iff
   * 'open_provider' is in availableActions. Null when the email had no
   * matchable link, or the row is locked (masked the same as description/
   * explanation). Never derive open_provider's presence separately from
   * this — they are set together by the backend.
   */
  callToActions: CallToAction[] | null;
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
 * Plan + feature flags for the signed-in user, mapped from the
 * `GET /billing/status` entitlement map (BE-030). Entitlement is always
 * determined by the backend — the frontend never calculates who gets what
 * (AGENTS.md).
 */
export interface Entitlements {
  plan: 'free' | 'pro';
  /** Discoveries visible to the plan; null = unlimited (Pro). */
  visibleDiscoveries: number | null;
  continuousMonitoring: boolean;
  reminders: boolean;
  calendarActions: boolean;
  emailActions: boolean;
  dailyBriefing: boolean;
  /**
   * Daily Detective Chat allowance; null = unlimited. The backend exposes the
   * static daily limit (`detectiveChatLimit`), not a server-decremented
   * remaining count — exhaustion still arrives as the chat endpoint's
   * 402 pro_required error.
   */
  chatQuestionsRemaining: number | null;
}

/**
 * Entitlement map of `GET /billing/status` — mirrors Inbox-api's
 * PLAN_ENTITLEMENTS (BE-012). `Infinity` limits serialize to `null` over
 * JSON, so Pro's unlimited fields arrive as null.
 */
export interface BillingEntitlementsWire {
  investigationEmailLimit: number;
  visibleDiscoveryLimit: number | null;
  continuousMonitoring: boolean;
  reminders: boolean;
  calendarActions: boolean;
  emailActions: boolean;
  detectiveChatLimit: number | null;
  historicalComparison: boolean;
  dailyBriefing: boolean;
  fullDiscoveryHistory: boolean;
}

/**
 * Wire body of `GET /billing/status` (BE-030) — the user's subscription state
 * plus the entitlement map for their plan. Verified against Inbox-api
 * src/api/routes/billing.routes.ts.
 */
export interface BillingStatusWire {
  plan: 'free' | 'pro';
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  entitlements: BillingEntitlementsWire;
}

/**
 * The gateable Pro features: the Entitlements fields that are boolean. Used by
 * RequiresPro/UpgradePrompt so a plan or numeric field can never be a feature.
 */
export type ProFeature = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * Authenticated user, as returned by `GET /account/me` (Inbox-api
 * account.routes.ts select — verified against the backend 2026-09-17).
 * Never stored in localStorage; the session lives in an httpOnly cookie.
 */
export interface User {
  id: string;
  email: string;
  /** Backend `displayName` — nullable in the schema. */
  displayName: string | null;
  photoUrl: string | null;
  /** `"free" | "pro"` — the backend coerces unknown values to free. */
  plan: 'free' | 'pro';
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  calendarConnected: boolean;
  gmailComposeEnabled: boolean;
  /** AI-prompt language of record (BE-043/BE-059). */
  locale: string;
  createdAt: string;
}

/** Billing cadence of a detected subscription. */
export type SubscriptionFrequency = 'monthly' | 'annual' | 'weekly';

/** A recurring charge detected in the user's inbox (FE-025). */
export interface Subscription {
  id: string;
  company: string;
  companyInitials: string;
  product?: string;
  currentAmount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  nextRenewal?: string;
  previousAmount?: number;
  priceChangedAt?: string;
  discoveryId?: string;
}

/** Response shape for `GET /subscriptions`. */
export interface SubscriptionListResponse {
  subscriptions: Subscription[];
}

/**
 * Wire shape of `GET /account/connections` (Inbox-api BE-035) — Google
 * connection state for the signed-in user. Booleans only; tokens are never
 * echoed back. This is the only connection-state surface the backend
 * exposes (there is no `GET /gmail/status`), so both Gmail and Calendar
 * status hooks read it.
 */
export interface AccountConnectionsWire {
  gmail: { connected: boolean; email: string };
  calendar: { connected: boolean };
  gmailCompose: { enabled: boolean };
}
