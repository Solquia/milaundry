import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { deleteOrder, type OrderWithDetails } from './api';
import { confirmAction } from './confirm';
import { deleteOrderPrompt } from './domain/confirm-prompts';
import { friendlyMerchantError } from './domain/merchant-error';
import { shortOrderId } from './domain/order-card';

/**
 * Asks, then erases one order for good: the owner's own test runs, which
 * would otherwise sit in the sales figures and the customer book forever.
 * Shared by a customer's page and the analytics "Clear test orders" sheet.
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remove = async (orderId: string) => {
    setError('');
    setDeletingId(orderId);
    try {
      await deleteOrder(orderId);
      queryClient.removeQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
    } catch (err: unknown) {
      setError(friendlyMerchantError('delete-order', err instanceof Error ? err.message : ''));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (order: OrderWithDetails) => {
    const total = order.final_total ?? order.estimated_total;
    confirmAction(deleteOrderPrompt(shortOrderId(order.id), total), () => remove(order.id));
  };

  return { confirmDelete, deletingId, error };
}
