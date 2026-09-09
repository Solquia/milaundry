/**
 * Peso formatting lives in the domain layer so pure logic (payment copy,
 * receipts, analytics) can format amounts without importing UI code.
 * `ui-kit` re-exports this as `formatMoney` for components.
 *
 * Thousands are grouped deliberately: a shop counter reads ₱2,841.00 at a
 * glance and has to count the digits in ₱2841.00. Grouping is done by hand
 * rather than via `Intl.NumberFormat` so the output is identical on every
 * device, the same reason `order-card.ts` avoids `toLocaleString`.
 */
/**
 * Centavo-accurate rounding; float drift must never reach a receipt. Lives
 * here beside the formatter because every module that subtracts two amounts —
 * change at the counter, a weighed bill against its estimate — needs the same
 * answer, and two copies of this would eventually disagree by a centavo.
 */
export function roundCentavos(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const [whole, centavos] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₱${grouped}.${centavos}`;
}

/**
 * The same amount without centavos it never had.
 *
 * A price list is read by scanning one column top to bottom, and `₱280.00`
 * repeated down every row spends four characters on nothing: PH laundry prices
 * are whole pesos almost without exception. Dropping the trailing `.00` takes
 * visible weight off the heaviest element on the screen without touching the
 * number.
 *
 * It never rounds. A shop that really charges ₱60.50 still reads ₱60.50 here,
 * because a price list that disagrees with the checkout is a broken promise.
 * Totals, receipts, and anything a customer pays keep `formatMoney`, where the
 * centavos column is what lets a column of figures be added up by eye.
 */
export function formatMoneyCompact(amount: number): string {
  const full = formatMoney(amount);
  return full.endsWith('.00') ? full.slice(0, -3) : full;
}
