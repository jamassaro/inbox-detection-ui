/**
 * Origin of the Inbox Detective web app. The API is reached through the same
 * origin (Firebase Hosting rewrites /auth, /account, /discoveries to the
 * backend), which keeps the httpOnly session cookie first-party.
 * Override at build time: VITE_EXTENSION_WEB_ORIGIN=http://localhost:5173
 */
export const WEB_ORIGIN = (
  import.meta.env.VITE_EXTENSION_WEB_ORIGIN || 'https://inbox-detection.web.app'
).replace(/\/+$/, '');

/** Discoveries shown in the panel. */
export const RECENT_LIMIT = 5;

/** App paths the extension may open in a new tab. */
export const ALLOWED_PATH_PREFIXES = ['/app/', '/upgrade'] as const;
