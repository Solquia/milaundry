/**
 * Taking an order across a counter, one category at a time.
 *
 * The POS printed a stepper card for every service the shop sells, all open at
 * once. At a shop with a full price list that is a screen and a half of
 * identical `− 0 kg +` controls, and the one in the screenshot sat directly
 * under `₱176.00/kg` — so the first reading of "0 kg" was *a price field you
 * have not filled in yet*. Nothing on the screen said the category came first.
 *
 * The shopfront and the owner's Prices screen had already answered this with
 * category doors; this module is what the same doors need to say when they are
 * standing over a live order rather than over a price list.
 *
 * The difference is the whole point. `categoryPriceSummary` next door tells an
 * owner auditing prices what a section holds. Mid-order that question is
 * already answered and a new one has replaced it: *what did I put in there*.
 * So a category that has been taken from stops quoting the shop's price spread
 * and starts quoting this order's charge, and every figure it quotes comes from
 * `estimateLineTotal` — the same function that will bill it — rather than from
 * a second multiplication that can disagree with the total at the bottom.
 */
import { formatMoney, formatMoneyCompact } from './money';
import { formatQuantity } from './price-label';
import { estimateLineTotal, type Service } from './pricing';

export type Quantities = Readonly<Record<string, number>>;

export interface IntakeLine {
  serviceId: string;
  name: string;
  /** The quantity as it will be billed — `5 kg`, `2 pieces`, `once`. */
  quantity: string;
  subtotal: number;
}

/** The shop's own minimum, or 0 when it has none that can be charged. */
function billableMinimum(service: Service): number {
  if (service.unit === 'flat') return 0;
  const minimum = service.min_quantity ?? 0;
  return Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
}

/**
 * What one tap on "Add" puts on the counter.
 *
 * A 5 kg-minimum service that opens at 0.5 kg shows a quantity the customer
 * will never be billed, and the first press of `+` appears to jump the total by
 * ₱150. Opening at the minimum means the figure on screen and the figure on the
 * order agree from the first tap.
 */
export function openingQuantity(service: Service): number {
  return billableMinimum(service) || 1;
}

/** The services in this group the order has actually taken something from. */
function chosen<T extends Service>(services: readonly T[], quantities: Quantities): T[] {
  return services.filter((service) => {
    const quantity = quantities[service.id];
    return Number.isFinite(quantity) && quantity > 0;
  });
}

/** A price the shop actually charges, as opposed to an unfinished row. */
function isCharged(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

/** `2 services · ₱35–₱55` — the shop's own range, for a door nothing came out of. */
function priceSpread(services: readonly Service[]): string {
  const count = `${services.length} ${services.length === 1 ? 'service' : 'services'}`;
  const charged = services.map((service) => service.price).filter(isCharged);
  if (charged.length === 0) return count;

  const low = formatMoneyCompact(Math.min(...charged));
  const high = formatMoneyCompact(Math.max(...charged));
  return low === high ? `${count} · ${low}` : `${count} · ${low}–${high}`;
}

/**
 * What a closed category says about itself mid-order.
 *
 * Before anything is taken it is a menu: how many services, and what they cost.
 * After, it is a receipt line: how many were chosen, and what they come to. The
 * charge is quoted in full pesos-and-centavos rather than the compact form the
 * menu uses — a range is being skimmed, a charge is being checked.
 */
export function intakeSummary(services: readonly Service[], quantities: Quantities): string {
  if (services.length === 0) return '';

  const taken = chosen(services, quantities);
  if (taken.length === 0) return priceSpread(services);

  const subtotal = taken.reduce(
    (sum, service) => sum + estimateLineTotal(service, quantities[service.id]),
    0
  );
  return `${taken.length} chosen · ${formatMoney(subtotal)}`;
}

/**
 * Everything on the counter, in the order the price list prints it.
 *
 * This is what lets a category close again without the merchant losing sight of
 * what they put in it — the door can fold away because the basket does not.
 *
 * The quantity shown is the *billed* one. A 3 kg load against a 5 kg minimum is
 * charged as 5 kg, and a row reading `3 kg — ₱175.00` looks like a bug to the
 * person holding the receipt.
 */
export function intakeLines<T extends Service>(
  services: readonly T[],
  quantities: Quantities
): IntakeLine[] {
  return chosen(services, quantities).map((service) => {
    const quantity = quantities[service.id];
    const billed = Math.max(quantity, billableMinimum(service));
    return {
      serviceId: service.id,
      name: service.name,
      quantity: service.unit === 'flat' ? 'once' : formatQuantity(service.unit, billed),
      subtotal: estimateLineTotal(service, quantity),
    };
  });
}
