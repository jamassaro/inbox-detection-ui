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

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
