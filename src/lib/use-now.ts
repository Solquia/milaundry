import { useEffect, useState } from 'react';

/** Often enough that a window shuts within a minute of passing; rare enough to cost nothing. */
const TICK_MS = 30 * 1000;

/**
 * The time, kept current while a screen stays open.
 *
 * The schedule step used to read the clock once per render and then sit.
 * Left open over lunch, it went on offering a 12–2 PM pickup at 1:30, and
 * the customer only found out on the last tap. With a clock that ticks, a
 * window that has gone shuts on screen, and "Today" turns over at midnight.
 */
export function useNow(tickMs: number = TICK_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  return now;
}
