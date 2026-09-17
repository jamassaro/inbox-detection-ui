/** jsdom window.location stubbing helper for redirect assertions. */
import { vi } from 'vitest';

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
