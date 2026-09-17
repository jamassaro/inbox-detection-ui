/** jsdom window.location stubbing helper for redirect assertions. */
import { vi } from 'vitest';

export const stubWindowLocation = () => {
  const original = window.location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = { search: '', replace: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).location = stub;
  return {
    replace: stub.replace as ReturnType<typeof vi.fn>,
    restore: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).location;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).location = original;
    },
  };
};
