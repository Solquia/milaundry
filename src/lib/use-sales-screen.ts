/**
 * The Sales screen's small pieces of memory, kept out of the screen so it
 * reads as layout: the daily goal and its once-a-day celebration, the toast
 * for a payment that lands while the screen is open, and today's drawer count.
 *
 * Stored values are held with the key they were loaded for (the shop, the
 * day), so switching shop or crossing midnight reads as "not loaded yet"
 * without an effect having to reset anything.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { DrawerClose } from './domain/day-close';
import { arrivedPayments } from './domain/live-payments';
import type { SalesPayment } from './domain/sales-metrics';
import { dayKey, goalProgress, shouldCelebrate } from './domain/sales-goal';
import {
  loadCelebrated,
  loadClose,
  loadGoal,
  saveCelebrated,
  saveClose,
  saveGoal,
  type SavedClose,
} from './sales-store';
import { useHaptic } from './use-app-settings';

interface StoredGoal {
  shopId: string;
  goal: number | null;
  celebrated: string | null;
}

export function useSalesGoal(shopId: string | undefined, collectedToday: number, now: Date) {
  const haptic = useHaptic();
  const [stored, setStored] = useState<StoredGoal | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const today = dayKey(now);

  useEffect(() => {
    if (!shopId) return;
    let isCurrent = true;
    void Promise.all([loadGoal(shopId), loadCelebrated(shopId)]).then(([goal, celebrated]) => {
      if (!isCurrent) return;
      // A celebration recorded in memory while the read was in flight wins over
      // the older stored day, or the burst could play twice.
      setStored((current) => ({
        shopId,
        goal,
        celebrated:
          current?.shopId === shopId && current.celebrated && (!celebrated || current.celebrated > celebrated)
            ? current.celebrated
            : celebrated,
      }));
    });
    return () => {
      isCurrent = false;
    };
  }, [shopId]);

  const isReady = stored !== null && stored.shopId === shopId;
  const goal = isReady ? stored.goal : null;
  const isHit = goal !== null && goalProgress(collectedToday, goal).isHit;

  // Decided while rendering, so the burst shows on the same frame the figure
  // crosses the line; recording "celebrated" first makes it fire once.
  if (isReady && goal !== null && shouldCelebrate(isHit, stored.celebrated, today)) {
    setStored({ ...stored, celebrated: today });
    setBurst(goal);
  }

  useEffect(() => {
    if (burst === null || !shopId) return;
    haptic('success');
    void saveCelebrated(shopId, today);
  }, [burst, shopId, today, haptic]);

  const setGoal = useCallback(
    (next: number | null) => {
      if (!shopId) return;
      setStored((current) => ({
        shopId,
        goal: next,
        celebrated: current?.shopId === shopId ? current.celebrated : null,
      }));
      void saveGoal(shopId, next);
    },
    [shopId]
  );

  const clearBurst = useCallback(() => setBurst(null), []);

  return { goal, setGoal, burst, clearBurst };
}

export function useLivePayments(shopId: string | undefined, payments: readonly SalesPayment[]) {
  const haptic = useHaptic();
  const seen = useRef<{ shopId: string | undefined; ids: Set<string> } | null>(null);
  const [toast, setToast] = useState<SalesPayment | null>(null);

  useEffect(() => {
    const last = seen.current;
    const before = last !== null && last.shopId === shopId ? last.ids : null;
    const arrived = arrivedPayments(before, payments);
    seen.current = { shopId, ids: new Set(payments.map((payment) => payment.id)) };
    if (arrived.length === 0) return;
    haptic('select');
    setToast(arrived[0]);
  }, [shopId, payments, haptic]);

  const clearToast = useCallback(() => setToast(null), []);
  return { toast, clearToast };
}

export function useDayClose(shopId: string | undefined, now: Date) {
  const [stored, setStored] = useState<{ key: string; close: SavedClose | null } | null>(null);
  const today = dayKey(now);
  const key = `${shopId ?? ''}:${today}`;

  useEffect(() => {
    if (!shopId) return;
    let isCurrent = true;
    void loadClose(shopId, today).then((close) => {
      if (isCurrent) setStored({ key: `${shopId}:${today}`, close });
    });
    return () => {
      isCurrent = false;
    };
  }, [shopId, today]);

  const save = useCallback(
    (close: DrawerClose) => {
      if (!shopId) return;
      const record: SavedClose = {
        closedAt: new Date().toISOString(),
        counted: close.counted,
        difference: close.difference,
        tone: close.tone,
      };
      setStored({ key: `${shopId}:${today}`, close: record });
      void saveClose(shopId, today, record);
    },
    [shopId, today]
  );

  return { saved: stored?.key === key ? stored.close : null, save };
}