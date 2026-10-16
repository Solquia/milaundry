import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAuth } from './auth';
import { withHidden, withoutHidden } from './domain/hidden-orders';
import { loadHiddenOrderIds, saveHiddenOrderIds } from './hidden-orders-store';

/**
 * The cleared-orders list, shared through the query cache so the order screen's
 * "Remove from home" and the home screen agree without a refetch.
 */
export function useHiddenOrders() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['hidden-orders', userId] as const, [userId]);

  const { data: ids } = useQuery({
    queryKey,
    queryFn: () => loadHiddenOrderIds(userId!),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  const hiddenIds = useMemo(() => new Set(ids ?? []), [ids]);

  const update = useCallback(
    (change: (current: readonly string[]) => string[]) => {
      if (!userId) return;
      const current = queryClient.getQueryData<string[]>(queryKey) ?? [];
      const next = change(current);
      queryClient.setQueryData(queryKey, next);
      void saveHiddenOrderIds(userId, next);
    },
    [queryClient, queryKey, userId]
  );

  const hide = useCallback(
    (orderIds: readonly string[]) => update((current) => withHidden(current, orderIds)),
    [update]
  );
  const unhide = useCallback(
    (orderIds: readonly string[]) => update((current) => withoutHidden(current, orderIds)),
    [update]
  );

  return { hiddenIds, hide, unhide };
}
