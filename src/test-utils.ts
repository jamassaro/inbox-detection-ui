/** jsdom window.location stubbing helper for redirect assertions. */
import { vi } from 'vitest';
import type { User } from './types';

/**
 * A valid signed-in User in the backend's /account/me shape (BE-035).
 * The FE-013 integration retyped `User` from `{ name, googleId }` to the
 * real wire; tests build users through this factory so the next contract
 * change is a one-file edit.
 */
export const makeTestUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada',
  photoUrl: null,
  plan: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  calendarConnected: true,
  gmailComposeEnabled: true,
  locale: 'en',
  createdAt: '2026-08-17T00:00:00.000Z',
  ...overrides,
});

export const stubWindowLocation = () => {
  const original = window.location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = { search: '', href: '', replace: vi.fn(), assign: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).location = stub;
  return {
    // Live getter — `window.location.href = …` on the stub must be visible
    // to assertions after the assignment.
    get href() {
      return stub.href as string;
    },
    replace: stub.replace as ReturnType<typeof vi.fn>,
    assign: stub.assign as ReturnType<typeof vi.fn>,
    restore: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).location;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).location = original;
    },
  };
};
