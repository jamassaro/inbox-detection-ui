/**
 * Google OAuth entry point (FE-007).
 *
 * The OAuth flow is a FULL PAGE redirect (`window.location.href`), never a
 * fetch/XHR — the browser must follow the backend's redirect chain (Google
 * consent → backend callback) for the httpOnly session cookie to be set.
 *
 * `returnPath` is stored in sessionStorage (NOT localStorage) so it is scoped
 * to the current tab session: the post-auth redirect target must not leak
 * into a different tab, nor survive a browser restart.
 */

/** sessionStorage key for the post-auth redirect target. */
export const RETURN_PATH_STORAGE_KEY = 'inbox-detective-auth-return-path';

/**
 * Reads and consumes the stored return path. Returns `null` for missing or
 * off-site values (`https://…`, protocol-relative `//…`) so a poisoned value
 * can never redirect the user away from the app after sign-in.
 */
export function consumeReturnPath(): string | null {
  const raw = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY);
  sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }
  return raw;
}

export interface StartGoogleAuthOptions {
  /** In-app path to land on after the callback resolves the session. */
  returnPath?: string;
}

/**
 * Kicks off Google sign-in. Resolves `VITE_API_BASE_URL` at call time and
 * refuses to navigate to an undefined URL when it is missing (the caller
 * shows the translated error fallback).
 *
 * @returns `true` when the redirect was started, `false` when the API base
 * URL is unconfigured (nothing was navigated).
 */
export function useGoogleAuth() {
  const startGoogleAuth = (options?: StartGoogleAuthOptions): boolean => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) {
      console.error(
        '[useGoogleAuth] VITE_API_BASE_URL is not configured — cannot start Google OAuth. ' +
          'Set it in your environment (see .env.example).',
      );
      return false;
    }

    // Store BEFORE navigating — the callback page reads it after the
    // full-page redirect chain returns.
    if (options?.returnPath) {
      sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, options.returnPath);
    }

    window.location.href = `${baseUrl}/auth/google`;
    return true;
  };

  return { startGoogleAuth };
}
