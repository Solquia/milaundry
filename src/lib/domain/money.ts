/**
 * Peso formatting lives in the domain layer so pure logic (payment copy,
 * receipts, analytics) can format amounts without importing UI code.
 * `ui-kit` re-exports this as `formatMoney` for components.
 */
export function formatMoney(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}
