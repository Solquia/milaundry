import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { claimOrder, registerWithShop } from './api';
import type { QrPayload } from './domain/qr';

/**
 * Finishes a scan for a customer who is already signed in: connects the shop
 * or claims the load, then drops the caches the result changed. Shared by the
 * camera and by a printed link the OS opened the app with, so both land the
 * same way. Throws the server's refusal for the caller to put into words.
 */
export function useSignedInScan(): (scan: QrPayload) => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(
    async (scan: QrPayload) => {
      if (scan.type === 'shop') {
        await registerWithShop(scan.id, scan.token);
        await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
        return;
      }
      await claimOrder(scan.id, scan.token);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['registered-shops'] }),
        queryClient.invalidateQueries({ queryKey: ['order', scan.id] }),
      ]);
    },
    [queryClient]
  );
}
