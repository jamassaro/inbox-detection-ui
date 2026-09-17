import { useEffect, useRef, useState } from 'react';

/** Duration of the count-up tween on live counters (ms). */
export const ANIMATION_MS = 600;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Eases the displayed count toward `target` (cubic ease-out) so a live
 * number ticks up instead of jumping. Honors prefers-reduced-motion by
 * collapsing the tween to a single frame that lands on the target.
 *
 * setState fires only from requestAnimationFrame callbacks — the effect
 * itself never sets state synchronously.
 */
export function useAnimatedNumber(target: number, durationMs = ANIMATION_MS): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : durationMs;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const value = Math.round(from + (target - from) * easeOutCubic(t));
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
