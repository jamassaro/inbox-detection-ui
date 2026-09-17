import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs`. FE-013 search: the input stays
 * responsive while the (client-side) filtering only re-runs after the user
 * pauses typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
