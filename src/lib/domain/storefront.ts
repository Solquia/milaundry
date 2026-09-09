/**
 * The two facts that decide whether a customer books here.
 *
 * A shop page used to open on a name and an address — true, and no reason to
 * buy. What a customer actually weighs at the top of a storefront is whether
 * other people were happy and what the cheapest way in costs. Both are already
 * in the data the screen loads; neither was ever said out loud.
 *
 * Both return `null` rather than a zero, because a new shop with no reviews and
 * a shop rated 0.0 are opposite things, and so are a shop with no price list
 * and a shop that charges nothing.
 */

export interface RatedReview {
  /** 1–5 stars, as written by `addReview`. */
  rating: number;
}

export interface PricedService {
  price: number;
}

export interface Reputation {
  /** Mean of the usable ratings, to one decimal. */
  average: number;
  /** How many ratings that mean was built from. */
  count: number;
  /** `4.5 · 12 reviews` — the average is worthless without the sample size. */
  label: string;
}

const MIN_STARS = 1;
const MAX_STARS = 5;

function isUsableRating(rating: number): boolean {
  return Number.isFinite(rating) && rating >= MIN_STARS && rating <= MAX_STARS;
}

/**
 * What this shop's customers say, as one line. Ratings come from the database
 * rather than from this screen, so anything outside the range the review form
 * can produce is dropped instead of being averaged into a claim the shop never
 * earned.
 */
export function shopReputation(reviews: readonly RatedReview[]): Reputation | null {
  const usable = reviews.map((review) => review.rating).filter(isUsableRating);
  if (usable.length === 0) return null;

  const total = usable.reduce((sum, rating) => sum + rating, 0);
  // Rounded before it is shown *and* before it is returned, so the number in
  // the label and the number a caller reads can never disagree.
  const average = Math.round((total / usable.length) * 10) / 10;
  const count = usable.length;

  return {
    average,
    count,
    // One decimal always: "5 · 1 review" next to "4.5 · 2 reviews" reads as two
    // different scales.
    label: `${average.toFixed(1)} · ${count} ${count === 1 ? 'review' : 'reviews'}`,
  };
}

/** The cheapest thing on the price list — the shop's way of saying "from ₱55". */
export function startingPrice(services: readonly PricedService[]): number | null {
  const payable = services
    .map((service) => service.price)
    .filter((price) => Number.isFinite(price) && price > 0);
  if (payable.length === 0) return null;
  return Math.min(...payable);
}
