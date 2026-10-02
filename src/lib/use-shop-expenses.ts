/**
 * The shop's expenses for a period, fetched once for the period and the one
 * it is compared with, and summed on the phone like the sales beside them.
 *
 * The query key carries dates, not the frame: the frame is rebuilt every
 * minute by `useNow`, the dates only change at midnight.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getShopExpenses } from './api';
import { expenseRange, summarizeExpenses } from './domain/expense-metrics';
import type { PeriodFrame } from './domain/sales-period';

export const shopExpensesKey = (shopId: string) => ['shop-expenses', shopId] as const;

/** After any add, edit or delete: every period of this shop's expenses refetches. */
export function invalidateShopExpenses(queryClient: QueryClient, shopId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: shopExpensesKey(shopId) });
}

export function useShopExpenses(shopId: string | undefined, frame: PeriodFrame) {
  const { from, to } = expenseRange(frame);
  const query = useQuery({
    queryKey: ['shop-expenses', shopId, from, to],
    queryFn: () => getShopExpenses(shopId!, from, to),
    enabled: Boolean(shopId),
  });
  const summary = useMemo(() => summarizeExpenses(query.data ?? [], frame), [query.data, frame]);
  return {
    summary,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
