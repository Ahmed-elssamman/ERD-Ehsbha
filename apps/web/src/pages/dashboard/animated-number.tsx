import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  /** The final numeric value to display. */
  value: number;
  /** Renders the (possibly fractional) animated number into a string. */
  format: (n: number) => string;
  /** Total animation duration in ms. */
  duration?: number;
}

/**
 * Count-up animation for KPI numbers. Re-runs when `value` changes.
 * Falls back to instant display when prefers-reduced-motion is on.
 */
export function AnimatedNumber({ value, format, duration = 700 }: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const startedAt = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startedAt.current = null;
    const target = value;

    const tick = (now: number) => {
      if (startedAt.current === null) startedAt.current = now;
      const elapsed = now - startedAt.current;
      const p = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduce]);

  return <>{format(display)}</>;
}
