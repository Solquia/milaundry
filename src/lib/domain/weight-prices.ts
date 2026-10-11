/**
 * A service priced by weight band rather than by one rate: "up to 8 kg ₱185,
 * up to 8.5 kg ₱200 … up to 16 kg ₱435" — the table on a laundry's wall.
 *
 * Stored on the service as `weight_prices` (0043), edited by the owner in the
 * service form, and read the same way here and on the server
 * (`public.weight_price`): the first row whose weight the load fits under
 * sets the price, and a load past the last row costs the last row. A service
 * with no rows is priced as it always was.
 */

export interface WeightPrice {
  /** The heaviest load this row's price covers, in kg. */
  up_to_kg: number;
  price: number;
}

/** A row as it reads on a board: the weights it covers, and its price. */
export interface WeightBand {
  from: number;
  to: number;
  price: number;
}

/** The booking's half-kilo step: a row covers from one step above the row before. */
const STEP_KG = 0.5;
export const MAX_WEIGHT_ROWS = 40;

function byWeight(rows: readonly WeightPrice[]): WeightPrice[] {
  return [...rows].sort((a, b) => a.up_to_kg - b.up_to_kg);
}

/** The price of a load of `kg`, or null when the service has no table. */
export function priceForWeight(rows: readonly WeightPrice[], kg: number): number | null {
  if (rows.length === 0) return null;
  const sorted = byWeight(rows);
  const row = sorted.find((entry) => kg <= entry.up_to_kg) ?? sorted[sorted.length - 1];
  return row.price;
}

/** Rows from the database, keeping only the well-formed ones. */
export function readWeightPrices(raw: unknown): WeightPrice[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const upTo = Number((entry as Record<string, unknown>).up_to_kg);
    const price = Number((entry as Record<string, unknown>).price);
    if (!(upTo > 0) || !Number.isFinite(price) || price < 0) return [];
    return [{ up_to_kg: upTo, price }];
  });
  return byWeight(rows);
}

/** The table as bands to print: "Up to 8 kg", "8.5 kg", "9 – 9.5 kg". */
export function weightBands(rows: readonly WeightPrice[]): WeightBand[] {
  const sorted = byWeight(rows);
  return sorted.map((row, index) => ({
    from: index === 0 ? 0 : sorted[index - 1].up_to_kg + STEP_KG,
    to: row.up_to_kg,
    price: row.price,
  }));
}

export type WeightPriceDraft = { upTo: string; price: string };

export type WeightPriceDraftResult =
  | { ok: true; value: WeightPrice[] }
  | { ok: false; error: string };

/** The owner's typed rows, checked and sorted before they are saved. */
export function validateWeightPriceDraft(drafts: readonly WeightPriceDraft[]): WeightPriceDraftResult {
  const filled = drafts.filter((draft) => draft.upTo.trim() || draft.price.trim());
  if (filled.length > MAX_WEIGHT_ROWS) {
    return { ok: false, error: `Keep the table to ${MAX_WEIGHT_ROWS} rows or fewer.` };
  }
  const rows: WeightPrice[] = [];
  for (const draft of filled) {
    if (!draft.upTo.trim() || !draft.price.trim()) {
      return { ok: false, error: 'Fill in both the weight and the price on every row.' };
    }
    const upTo = Number(draft.upTo.trim());
    const price = Number(draft.price.trim());
    if (!(upTo > 0) || upTo > 100) {
      return { ok: false, error: `"${draft.upTo}" is not a weight between 0 and 100 kg.` };
    }
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      return { ok: false, error: `"${draft.price}" is not a price.` };
    }
    if (rows.some((row) => row.up_to_kg === upTo)) {
      return { ok: false, error: `${upTo} kg is on the table twice.` };
    }
    rows.push({ up_to_kg: upTo, price });
  }
  return { ok: true, value: byWeight(rows) };
}
