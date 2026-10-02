/**
 * Resolves `VITE_API_BASE_URL` for every API entry point (apiFetch, the Google
 * and Gmail OAuth redirects).
 *
 * Unset → `null` (misconfigured). An EMPTY string is valid and means
 * "same origin": production reaches the backend through Firebase Hosting
 * rewrites (see firebase.json) and dev through the Vite proxy, so the session
 * cookie stays first-party. Trailing slashes are trimmed.
 */
export function getApiBaseUrl(): string | null {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  if (baseUrl === undefined) return null
  return baseUrl.replace(/\/+$/, '')
}
