import type { Discovery } from '../../src/types';
import type {
  ExtensionRequest,
  OpenUrlResponse,
  RecentDiscoveriesResponse,
} from './messages';

export class UnauthenticatedError extends Error {}

const send = async <T>(request: ExtensionRequest): Promise<T | undefined> => {
  try {
    return (await chrome.runtime.sendMessage(request)) as T | undefined;
  } catch {
    return undefined; // e.g. extension reloaded: "context invalidated"
  }
};

/** Recent discoveries via the service worker; credentials never enter this world. */
export async function fetchRecentDiscoveries(locale: string): Promise<Discovery[]> {
  const res = await send<RecentDiscoveriesResponse>({ type: 'GET_RECENT_DISCOVERIES', locale });
  if (res?.status === 'ok') return res.discoveries;
  if (res?.status === 'unauthenticated') throw new UnauthenticatedError();
  throw new Error('recent discoveries failed');
}

/** Opens an app path (e.g. /app/discoveries/:id) in a new tab. */
export async function openAppPath(path: string): Promise<void> {
  await send<OpenUrlResponse>({ type: 'OPEN_URL', path });
}
