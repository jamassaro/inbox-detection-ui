/**
 * Demo mode: the whole app runs against the in-memory mock API
 * (src/mocks/mockApi.ts) instead of the real backend, so visitors can explore
 * with sample data without connecting Gmail.
 *
 * The mock layer replaces `window.fetch` once, before React mounts (see
 * main.tsx), so entering or leaving demo is a full page load rather than a
 * state change. The flag lives in sessionStorage (NOT localStorage): it is
 * not a credential, but it must expire with the tab so a later visit starts
 * from the real sign-in flow. `VITE_USE_MOCKS=true` still forces demo for
 * local development.
 */

/** sessionStorage key for the demo flag. */
export const DEMO_STORAGE_KEY = 'inbox-detective-demo';

const DEMO_ENTRY_PATH = '/app/dashboard';
const LANDING_PATH = '/';

function readFlag(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** True when this page load runs on mock data (demo flag or `VITE_USE_MOCKS=true`). */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true' || readFlag();
}

/** Drops the demo flag. Called before real sign-in so live auth never runs under mocks. */
export function clearDemoFlag(): void {
  try {
    window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/** Starts the demo: sets the flag and reloads into the app so the mocks install first. */
export function enterDemo(): void {
  try {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, 'true');
  } catch {
    // Storage blocked: the reload below would not stay in demo, so do nothing.
    return;
  }
  window.location.assign(DEMO_ENTRY_PATH);
}

/** Leaves the demo and returns to the landing page on the real backend. */
export function exitDemo(): void {
  clearDemoFlag();
  window.location.assign(LANDING_PATH);
}
