/**
 * The proof behind the actual price.
 *
 * When a shop weighs a booking, the number on the customer's phone changes —
 * and a number that moves without evidence reads as a bait-and-switch. The
 * merchant already photographs the load on the scale (`weigh-sheet.tsx`); this
 * decides when that photo is shown to the customer and what it is captioned.
 *
 * The rule is strict on purpose: evidence appears only once there is a
 * confirmed price for it to back. A photo without a price would present proof
 * of a figure the customer has not been given yet.
 */

export interface EvidenceOrder {
  /** null until the shop has weighed the laundry. */
  final_total: number | null;
  /** What the shop's scale actually read; null when it was not stored. */
  actual_weight_kg: number | null;
  /** Private storage key for the photo of the weighed load. */
  weigh_photo_path: string | null;
}

export interface WeighEvidence {
  /** Storage key — the screen turns this into a short-lived signed URL. */
  photoPath: string;
  /** One line under the photo saying what it shows. */
  caption: string;
}

/**
 * A scale reading as the dial shows it: whole kilos bare, fractions kept.
 * Rounded to two decimals first so float drift (0.1 + 0.2) never prints.
 */
export function formatKg(weight: number): string {
  const rounded = Math.round(weight * 100) / 100;
  return `${rounded} kg`;
}

/** The photo and its caption, or null when there is nothing to stand behind. */
export function weighEvidence(order: EvidenceOrder): WeighEvidence | null {
  if (!order.weigh_photo_path || order.final_total === null) return null;

  return {
    photoPath: order.weigh_photo_path,
    caption:
      order.actual_weight_kg === null
        ? 'Your laundry on the shop’s scale'
        : `Your laundry on the scale: ${formatKg(order.actual_weight_kg)}`,
  };
}
