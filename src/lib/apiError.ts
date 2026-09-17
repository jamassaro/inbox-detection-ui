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
