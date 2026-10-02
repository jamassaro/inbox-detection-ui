import { toDiscovery } from '../../src/lib/discoveryWire';
import type { DiscoveriesWire } from '../../src/lib/discoveryWire';
import { ALLOWED_PATH_PREFIXES, RECENT_LIMIT, WEB_ORIGIN } from '../config';
import type {
  ExtensionRequest,
  OpenUrlResponse,
  RecentDiscoveriesResponse,
} from '../services/messages';

type FetchFn = typeof fetch;

export interface HandlerDeps {
  fetchFn: FetchFn;
  openTab: (url: string) => Promise<unknown> | void;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight POST /auth/refresh (the refresh token is single-use and
 * rotating, so concurrent refreshes must share one request). Mirrors
 * src/lib/apiClient.ts, which can't run here because it needs `window`.
 */
function refreshSession(fetchFn: FetchFn): Promise<boolean> {
  refreshInFlight ??= fetchFn(`${WEB_ORIGIN}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

const getDiscoveries = (fetchFn: FetchFn, locale: string) =>
  fetchFn(`${WEB_ORIGIN}/discoveries?status=active&limit=${RECENT_LIMIT}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Accept-Language': locale },
  });

/** Fetches the newest discoveries, refreshing the session once on a 401. */
export async function loadRecentDiscoveries(
  fetchFn: FetchFn,
  locale: string,
): Promise<RecentDiscoveriesResponse> {
  try {
    let res = await getDiscoveries(fetchFn, locale);
    if (res.status === 401) {
      if (!(await refreshSession(fetchFn))) return { status: 'unauthenticated' };
      res = await getDiscoveries(fetchFn, locale);
      if (res.status === 401) return { status: 'unauthenticated' };
    }
    if (!res.ok) return { status: 'error' };

    const body = (await res.json()) as DiscoveriesWire;
    const discoveries = body.discoveries
      .map(toDiscovery)
      // The backend has no `sort` param; order newest-first within the window.
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { status: 'ok', discoveries };
  } catch {
    return { status: 'error' };
  }
}

/** Resolves an app path against WEB_ORIGIN; null unless it is an allow-listed app path. */
export function resolveAppUrl(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  try {
    const url = new URL(path, WEB_ORIGIN);
    return url.origin === WEB_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRequest(message: unknown): message is ExtensionRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return (
    (m.type === 'GET_RECENT_DISCOVERIES' && typeof m.locale === 'string') ||
    (m.type === 'OPEN_URL' && typeof m.path === 'string')
  );
}

export async function handleRequest(
  message: unknown,
  deps: HandlerDeps,
): Promise<RecentDiscoveriesResponse | OpenUrlResponse> {
  if (!isRequest(message)) return { status: 'error' };

  if (message.type === 'GET_RECENT_DISCOVERIES') {
    return loadRecentDiscoveries(deps.fetchFn, message.locale);
  }

  const url = resolveAppUrl(message.path);
  if (!url) return { status: 'error' };
  await deps.openTab(url);
  return { status: 'ok' };
}
