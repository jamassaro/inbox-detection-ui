import type { Discovery } from '../../src/types';

/** Content script → service worker. */
export type ExtensionRequest =
  | { type: 'GET_RECENT_DISCOVERIES'; locale: string }
  | { type: 'OPEN_URL'; path: string };

/** Service worker → content script. Carries display data only, never credentials. */
export type RecentDiscoveriesResponse =
  | { status: 'ok'; discoveries: Discovery[] }
  | { status: 'unauthenticated' }
  | { status: 'error' };

export type OpenUrlResponse = { status: 'ok' } | { status: 'error' };
