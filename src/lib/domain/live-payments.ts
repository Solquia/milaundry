/**
 * Payments that landed since the screen last looked, for the live toast.
 *
 * The first look has nothing to compare with, so it announces nothing:
 * opening the screen must not replay the whole day as a burst of toasts.
 */
export function arrivedPayments<T extends { id: string }>(
  seen: ReadonlySet<string> | null,
  payments: readonly T[]
): T[] {
  if (seen === null) return [];
  return payments.filter((payment) => !seen.has(payment.id));
}