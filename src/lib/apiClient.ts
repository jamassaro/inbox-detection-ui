import { ApiError } from './apiError'

/** Window event dispatched when the backend responds 401 (consumed by AuthContext, FE-003). */
export const AUTH_EXPIRED_EVENT = 'auth:expired'

const LOCALE_STORAGE_KEY = 'inbox-detective-locale'
const DEFAULT_LOCALE = 'en'

/** Reads the active locale (explicit user selection, else browser default `en`). */
function getAcceptLanguage(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }
  return window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? DEFAULT_LOCALE
}

/** Resolves the API base URL from the environment — never hardcoded. */
function resolveBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  if (!baseUrl) {
    throw new Error(
      'VITE_API_BASE_URL is not configured. Set it in your environment (see .env.example).',
    )
  }
  return baseUrl
}

/** Extracts `{ code, message }` from an error response body, tolerating non-JSON bodies. */
async function parseErrorBody(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null) {
      return body as { code?: string; message?: string }
    }
    return {}
  } catch {
    return {}
  }
}

/** RequestInit plus fetch-layer controls for {@link apiFetch}. */
export interface ApiFetchOptions extends RequestInit {
  /**
   * Emit the `auth:expired` window event on a 401 response (default true).
   * Supplied as false by consumers whose 401 is an expected answer rather
   * than a mid-use expiry — the bootstrap session check and the callback
   * page's own session read. Emitting there would bounce an already-logged-
   * out visitor into an app reload loop (each reload re-running the check).
   */
  authExpiredEvent?: boolean
}

/**
 * Centralized fetch wrapper — the only way components and hooks talk to the backend.
 *
 * - Base URL comes from `import.meta.env.VITE_API_BASE_URL`
 * - Session cookie is sent via `credentials: 'include'` (httpOnly cookie, no token storage)
 * - `Accept-Language` is attached from the active locale so AI-generated
 *   content comes back in the user's language
 * - 401 responses dispatch the `auth:expired` window event (decoupling the API
 *   layer from AuthContext to avoid circular imports) unless suppressed via
 *   `authExpiredEvent: false`
 * - Non-2xx responses throw a typed {@link ApiError} with `{ status, code, message }`
 */
export async function apiFetch<T = unknown>(
  path: string,
  { authExpiredEvent = true, ...options }: ApiFetchOptions = {},
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getAcceptLanguage())
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown network error'
    throw new ApiError(0, 'NETWORK_ERROR', `Network request failed: ${detail}`)
  }

  if (response.status === 401 && authExpiredEvent) {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
  }

  if (!response.ok) {
    const body = await parseErrorBody(response)
    throw new ApiError(
      response.status,
      body.code ?? 'UNKNOWN_ERROR',
      body.message ?? `Request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
