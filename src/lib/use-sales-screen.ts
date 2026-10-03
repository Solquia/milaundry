/**
 * The Sales screen's small pieces of memory, kept out of the screen so it
 * reads as layout: the daily goal and its once-a-day celebration, the toast
 * for a payment that lands while the screen is open, and today's drawer count.
 *
 * Stored values are held with the key they were loaded for (the shop, the
 * day), so switching shop or crossing midnight reads as "not loaded yet"
 * without an effect having to reset anything.
 *
 * The goal and the drawer count live on the server (0040), so a second
 * tablet or the web dashboard sees them. The phone keeps a copy: it answers
 * when the server cannot, and a goal set before 0040 is uploaded once.
 * The once-a-day celebration stays on the device — it is this screen's.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDayClose, getSalesGoal, saveDayClose, setSalesGoal } from './api';

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

interface StoredCheer {
  shopId: string;
  celebrated: string | null;
}

const salesGoalKey = (shopId: string | undefined) => ['sales-goal', shopId] as const;
const dayCloseKey = (shopId: string | undefined, day: string) => ['day-close', shopId, day] as const;

/** The server's goal; a goal only this phone knows is uploaded the first time. */
async function readGoal(shopId: string): Promise<number | null> {
  try {
    const server = await getSalesGoal(shopId);
    if (server.hasRow) return server.goal;
    const local = await loadGoal(shopId);
    if (local !== null) await setSalesGoal(shopId, local);
    return local;
  } catch {
    return loadGoal(shopId);
  }
}

async function readClose(shopId: string, day: string): Promise<SavedClose | null> {
  try {
    return (await getDayClose(shopId, day)) ?? (await loadClose(shopId, day));
  } catch {
    return loadClose(shopId, day);
  }
}

export function useSalesGoal(shopId: string | undefined, collectedToday: number, now: Date) {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const [cheer, setCheer] = useState<StoredCheer | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const today = dayKey(now);
  const goalQuery = useQuery({
    queryKey: salesGoalKey(shopId),
    queryFn: () => readGoal(shopId!),
    enabled: Boolean(shopId),
  });

  useEffect(() => {
    if (!shopId) return;
    let isCurrent = true;
    void loadCelebrated(shopId).then((celebrated) => {
      if (!isCurrent) return;
      // A celebration recorded in memory while the read was in flight wins over
      // the older stored day, or the burst could play twice.
      setCheer((current) => ({
        shopId,
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

  const isReady = goalQuery.isSuccess && cheer !== null && cheer.shopId === shopId;
  const goal = goalQuery.data ?? null;
  const isHit = goal !== null && goalProgress(collectedToday, goal).isHit;

  // Decided while rendering, so the burst shows on the same frame the figure
  // crosses the line; recording "celebrated" first makes it fire once.
  if (isReady && goal !== null && shouldCelebrate(isHit, cheer.celebrated, today)) {
    setCheer({ ...cheer, celebrated: today });
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
      queryClient.setQueryData(salesGoalKey(shopId), next);
      void saveGoal(shopId, next);
      // The phone's copy already holds it; a failed upload is retried by the
      // next save, and the screen never shows an error for a personal target.
      setSalesGoal(shopId, next).catch(() => undefined);
    },
    [shopId, queryClient]
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
  const queryClient = useQueryClient();
  const today = dayKey(now);
  const closeQuery = useQuery({
    queryKey: dayCloseKey(shopId, today),
    queryFn: () => readClose(shopId!, today),
    enabled: Boolean(shopId),
  });

  const save = useCallback(
    (close: DrawerClose) => {
      if (!shopId) return;
      const record: SavedClose = {
        closedAt: new Date().toISOString(),
        counted: close.counted,
        difference: close.difference,
        tone: close.tone,
      };
      queryClient.setQueryData(dayCloseKey(shopId, today), record);
      void saveClose(shopId, today, record);
      saveDayClose(shopId, today, record).catch(() => undefined);
    },
    [shopId, today, queryClient]
  );

  return { saved: closeQuery.data ?? null, save };
}