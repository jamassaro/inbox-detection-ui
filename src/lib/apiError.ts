/**
 * Typed error thrown by `apiFetch` on any failed API interaction.
 *
 * Shape aligns with the backend's structured error responses
 * (`{ code, message }`) so callers can map `code` through the
 * `errors` i18n namespace. A `status` of 0 signals a network-level
 * failure (the request never got a response).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * Raw parsed JSON body of the error response, when the server sent one.
   * Several backend routes answer with `{ error, connectUrl }`-style bodies
   * that carry no `code`/`message` fields (BE-033: `calendar_not_connected`);
   * this keeps those contract fields readable without widening `code`.
   */
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * True when the error is the backend's "Calendar consent not completed"
 * answer (BE-033): a 400 whose body is `{ error: 'calendar_not_connected',
 * connectUrl: '/calendar/connect' }`. Callers use it to switch the UI to the
 * contextual connect flow instead of a generic failure.
 */
export function isCalendarNotConnected(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    typeof error.body === 'object' &&
    error.body !== null &&
    (error.body as { error?: unknown }).error === 'calendar_not_connected'
  );
}

/** Parsed `402 pro_required` body: `{ error, upgradeContext, message, checkoutUrl }`. */
export interface ProRequiredInfo {
  /** Backend paywall trigger (e.g. which feature was hit) — drives the upgrade headline. */
  upgradeContext?: string;
  /** Backend-authored explanation; localized by `Accept-Language`. */
  message?: string;
  /** Relative backend path to start checkout (e.g. '/billing/checkout'). */
  checkoutUrl?: string;
}

/**
 * Returns the `pro_required` details when `error` is the backend's generic
 * Pro-gate answer (402 with `{ error: 'pro_required', … }`), else `null`.
 * Use it wherever a Pro route is called instead of re-checking `status === 402`
 * — a 402 with a different body (e.g. a locked Discovery) is not this shape.
 */
export function getProRequired(error: unknown): ProRequiredInfo | null {
  if (!(error instanceof ApiError) || error.status !== 402) return null;
  const body = error.body;
  if (typeof body !== 'object' || body === null) return null;
  const { error: kind, upgradeContext, message, checkoutUrl } = body as Record<string, unknown>;
  if (kind !== 'pro_required') return null;
  return {
    ...(typeof upgradeContext === 'string' && { upgradeContext }),
    ...(typeof message === 'string' && { message }),
    ...(typeof checkoutUrl === 'string' && { checkoutUrl }),
  };
}
