/**
 * How a price reads to the person paying it.
 *
 * The billing rule lives in `pricing.ts` — `estimateLineTotal` quietly bills
 * `max(quantity, min_quantity)`. That is correct, but a customer who taps "+"
 * once on a 3 kg-minimum service watches ₱180 appear where they expected ₱60.
 * These helpers make the shop's own rule visible before the total moves, and
 * keep one word for one unit across the customer and merchant screens.
 */
import { formatMoney, formatMoneyCompact } from './money';
import { estimateLineTotal, type PricingUnit, type Service } from './pricing';

/** The suffix after a unit price: `₱60.00` + `/kg`. */
export function unitSuffix(unit: PricingUnit): string {
  if (unit === 'per_kg') return '/kg';
  if (unit === 'per_item') return '/piece';
  return ' flat';
}

/**
 * The unit set beneath a price that already stands in its own column, or null
 * when the figure needs no unit at all.
 *
 * `unitSuffix` returns " flat" so `₱75.00 flat` reads as a sentence. Stacked
 * under the figure as a bare word, "flat" is trade vocabulary: a customer reads
 * it as a missing unit rather than as "this is the whole price". A flat price
 * says everything it needs to by being a number.
 */
export function unitCaption(unit: PricingUnit): string | null {
  if (unit === 'flat') return null;
  return unitSuffix(unit);
}

/** A quantity with its unit — `3 kg`, `1 piece`, `2 pieces`. */
export function formatQuantity(unit: PricingUnit, quantity: number): string {
  if (unit === 'per_kg') return `${quantity} kg`;
  return `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}`;
}

/**
 * How much a booked order line holds, or null when a flat charge has nothing
 * to say. A flat line only carries a quantity other than 1 when it is a load
 * booked by weight — add-ons go one line per piece and the counter books flat
 * once — so that quantity is kilos, not pieces or a multiplier.
 */
export function lineQuantity(unit: PricingUnit, quantity: number): string | null {
  if (unit !== 'flat') return formatQuantity(unit, quantity);
  return quantity > 0 && quantity !== 1 ? `${quantity} kg` : null;
}

/**
 * An order line as the customer's bill names it: `Wash & Fold × 5 kg`,
 * `Comforter × 2`, `Wash Only · 5 kg`, or just `Delivery` for a one-off charge.
 */
export function lineLabel(name: string, unit: PricingUnit, quantity: number): string {
  if (unit === 'per_kg') return `${name} × ${quantity} kg`;
  if (unit === 'per_item') return `${name} × ${quantity}`;
  const load = lineQuantity(unit, quantity);
  return load ? `${name} · ${load}` : name;
}

/**
 * The billable minimum, or 0 when none applies. Flat services are billed once
 * regardless of quantity, so a minimum on one is noise, not a charge.
 */
function effectiveMinimum(service: Service): number {
  if (service.unit === 'flat') return 0;
  const minimum = service.min_quantity ?? 0;
  return Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
}

/**
 * The shop's minimum stated on its own — `3 kg minimum` — for surfaces that
 * already print the figure in a column of its own.
 *
 * The storefront used `formatPriceLine` under every service name, which put
 * `₱280.00/piece` directly beneath a `₱280.00` in the price column: the same
 * number twice on one row, saying nothing new. Only the minimum is a fact the
 * figure cannot carry, so only the minimum stays.
 */
export function minimumLabel(service: Service): string | null {
  const minimum = effectiveMinimum(service);
  if (minimum === 0) return null;
  return `${formatQuantity(service.unit, minimum)} minimum`;
}

/**
 * The whole price as one quiet line beneath a service name — `₱60/kg · 3 kg
 * minimum` — for the card layout where the price sits where a shop card puts
 * its address.
 *
 * Differs from `formatPriceLine` in dropping centavos a price never had: a
 * subtitle is read, not added up, so `₱280.00` spends four characters proving
 * nothing. Anything the shop really charges in centavos survives untouched.
 */
export function priceSubtitle(service: Service): string {
  const caption = capacityLabel(service) ? lineSuffix(service) : unitCaption(service.unit);
  return withFacts(`${formatMoneyCompact(service.price)}${caption ?? ''}`, service);
}

/**
 * The most one load may weigh — `max 6 kg per load` — or null when the shop
 * set no limit, or charges by the piece and never weighs.
 */
export function capacityLabel(service: Service): string | null {
  if (service.unit === 'per_item') return null;
  const maximum = service.max_quantity ?? 0;
  if (!Number.isFinite(maximum) || maximum <= 0) return null;
  return `max ${maximum} kg per load`;
}

/**
 * The unit after a price in a sentence. A flat price with a load limit is
 * what a laundromat's board calls "per load", so it says so.
 */
function lineSuffix(service: Service): string {
  if (service.unit === 'flat' && capacityLabel(service)) return '/load';
  return unitSuffix(service.unit);
}

function withFacts(price: string, service: Service): string {
  return [price, minimumLabel(service), capacityLabel(service)].filter(Boolean).join(' · ');
}

/** The price subtitle under a service name: `₱60.00/kg · 3 kg minimum`. */
export function formatPriceLine(service: Service): string {
  return withFacts(`${formatMoney(service.price)}${lineSuffix(service)}`, service);
}

/**
 * The warning shown while a chosen quantity sits below the minimum, quoting the
 * amount `estimateLineTotal` will actually charge — never a recomputed guess.
 */
export function minimumChargeNotice(service: Service, quantity: number): string | null {
  const minimum = effectiveMinimum(service);
  if (minimum === 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (quantity >= minimum) return null;

  const billed = formatQuantity(service.unit, minimum);
  const total = formatMoney(estimateLineTotal(service, minimum));
  return `${billed} minimum — you'll be billed for ${billed} (${total}).`;
}
