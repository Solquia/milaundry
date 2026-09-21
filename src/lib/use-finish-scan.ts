import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { claimOrder, getRegisteredShops, registerWithShop } from './api';
import type { Role } from './domain/splash-gate';
import { afterAuthRoute, fallbackRouteAfterFailedScan } from './domain/welcome-flow';
import { takePendingScan } from './pending-scan-store';

/**
 * Finishes the scan a guest made before signing in, and says where to land.
 *
 * Called the moment a session exists — the Supabase client already carries it,
 * so the same RPCs the signed-in scanner uses work here. The pre-join count is
 * sampled *before* registering so the shopfront can stage the right welcome:
 * "your first laundry" for a brand-new account, the quieter card otherwise.
 *
 * If the server refuses the scan (the shop went inactive between the scan and
 * the sign-in, the order was claimed by someone else), the session still
 * stands. The customer is sent to the shopfront, where the connect control is
 * one tap away, rather than to an error they can do nothing about.
 */
export function useFinishScan(): (role?: Role | null) => Promise<string> {
  const queryClient = useQueryClient();

  return useCallback(async (role?: Role | null) => {
    const scan = takePendingScan();
    if (!scan) return afterAuthRoute(null, 0, role);

    try {
      if (scan.type === 'shop') {
        const already = await getRegisteredShops();
        const prior = already.filter((shop) => shop.id !== scan.id).length;
        await registerWithShop(scan.id, scan.token);
        await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
        return afterAuthRoute(scan, prior);
      }

      await claimOrder(scan.id, scan.token);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['registered-shops'] }),
      ]);
      return afterAuthRoute(scan, 0);
    } catch {
      return fallbackRouteAfterFailedScan(scan);
    }
  }, [queryClient]);
}
