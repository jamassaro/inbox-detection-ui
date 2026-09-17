import type { DiscoveryAction } from '../types';

/**
 * Why the user landed on /upgrade: the paywall trigger they hit, the screen
 * they came from, and (optionally) the discovery + pending action they were
 * interrupted on. FE-017 consumes this after Stripe checkout to return the
 * user to exactly where they left off and complete the pending action.
 *
 * sessionStorage (NOT localStorage) — the context must not survive a new
 * browser session (AGENTS.md Security Rules #5). Stripe may return to the
 * app through a full page load, so sessionStorage is the strongest
 * persistence that still expires with the session.
 */
export interface UpgradeContext {
  /**
   * Paywall trigger that opened the upgrade page. Doubles as the `?from=`
   * query param value and the headline selector — see UpgradePage.
   */
  source: string;
  /** App path to return to after a successful upgrade, e.g. '/app/chat'. */
  returnPath: string;
  /** Discovery the user was on when they hit the paywall, when applicable. */
  discoveryId?: string;
  /** Action the user was trying to perform when interrupted, when applicable. */
  pendingAction?: DiscoveryAction;
}

const STORAGE_KEY = 'inbox-detective-upgrade-context';

/** Best-effort parse: `null` for anything that is not a plausible context. */
function deserialize(raw: string | null): UpgradeContext | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as UpgradeContext).source === 'string' &&
      typeof (parsed as UpgradeContext).returnPath === 'string'
    ) {
      return parsed as UpgradeContext;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persists the upgrade context for this browser session (overwrites any previous one). */
export function saveUpgradeContext(ctx: UpgradeContext): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
}

/**
 * Reads the stored upgrade context, or `null` when absent/corrupt.
 * Never throws — a malformed entry behaves like a missing one.
 */
export function readUpgradeContext(): UpgradeContext | null {
  return deserialize(window.sessionStorage.getItem(STORAGE_KEY));
}

/** Removes the upgrade context — call once it has been consumed (FE-017). */
export function clearUpgradeContext(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
