/**
 * A service as the owner types it, checked before anything is saved.
 *
 * The add form used to start on Wash & Fold, per kg, with a minimum of "0"
 * already typed, and accepted ₱0. So "Comforter" landed in Wash & Fold billed
 * by the kilo unless the owner noticed two defaults they had never chosen, and
 * a detergent went on the price list as a free service. Here nothing is
 * answered for the owner, every problem is reported against its own field at
 * once, and the edit form opens from the same draft so every field can change.
 */
import { formatMoneyCompact } from './money';
import { CATEGORY_ORDER, type ServiceCategory } from './service-catalog';
import { isWeighed, type PricingUnit } from './pricing';
import type { WeightPrice } from './weight-prices';

/**
 * How the owner says they charge. "Per load" is not a unit of its own on the
 * server: it is a flat price with a load size, which the till weighs and bills
 * once per load (13 kg at 6 kg a load is three loads). Hidden under "Flat
 * price → most per load", owners could not find it, so the form names it.
 */
export type ChargeKind = PricingUnit | 'per_load';

/**
 * Where a weighed service's price comes from: one price (per kg, per load or
 * per job), or the shop's weight table. Never both — a load size beside a
 * table read as two prices for the same load.
 */
export type PriceBy = 'one' | 'table';

export interface ServiceDraft {
  name: string;
  category: ServiceCategory | null;
  unit: ChargeKind | null;
  price: string;
  minQuantity: string;
  /** Most a load may weigh, in kg; blank means no limit, except per load, where it is the load size. */
  maxQuantity: string;
  description: string;
  /** Absent means one price. */
  priceBy?: PriceBy;
}

export type ServiceDraftField =
  | 'name'
  | 'category'
  | 'unit'
  | 'price'
  | 'minQuantity'
  | 'maxQuantity'
  | 'weightPrices';

export interface ServiceValues {
  name: string;
  category: ServiceCategory;
  unit: PricingUnit;
  price: number;
  min_quantity: number;
  max_quantity: number;
  description: string;
  /** The weight table; empty when the service charges one price. */
  weight_prices: WeightPrice[];
}

export type ServiceDraftResult =
  | { ok: true; value: ServiceValues }
  | { ok: false; errors: Partial<Record<ServiceDraftField, string>> };

export const EMPTY_SERVICE_DRAFT: ServiceDraft = {
  name: '',
  category: null,
  unit: null,
  price: '',
  minQuantity: '',
  maxQuantity: '',
  description: '',
};

const NAME_LIMIT = 60;

/** `null` for a blank field, `NaN` for text that is not a number. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
}

function priceError(price: number | null): string | undefined {
  if (price === null) return 'Enter a price.';
  if (Number.isNaN(price) || price < 0) return 'Enter a price in pesos, like 35.';
  if (price === 0) return 'Customers would see ₱0 as free. Enter what you charge.';
  return undefined;
}

function minimumError(minimum: number | null): string | undefined {
  if (minimum === null) return undefined;
  if (Number.isNaN(minimum) || minimum < 0) {
    return 'Enter the smallest load in kg, like 5, or leave it blank.';
  }
  return undefined;
}

/** A unit the laundry is weighed for, so a weight table can price it. */
export function takesWeightTable(unit: ChargeKind | null): boolean {
  return unit === 'per_kg' || unit === 'per_load' || unit === 'flat';
}

/** A load limit only means something where the laundry is weighed or loaded. */
function takesLoadLimit(unit: ChargeKind | null): boolean {
  return unit === 'per_kg' || unit === 'flat' || unit === 'per_load';
}

function loadSizeError(unit: ChargeKind | null, maximum: number | null): string | undefined {
  if (unit !== 'per_load' || maximum !== null) return undefined;
  return 'Enter how many kg one load holds, like 4.';
}

/** Bedding is counted by the piece; a load size there reads as a size per piece. */
function chargeKindError(unit: ChargeKind | null, category: ServiceCategory | null): string | undefined {
  if (!unit) return 'Choose how you charge for it.';
  if (unit === 'per_load' && category === 'special_items') {
    return 'Bedding is charged by the piece. Choose Per piece or Flat price, or another section.';
  }
  return undefined;
}

/** What the server stores: a per-load price is a flat price with a load size. */
function storedUnit(unit: ChargeKind): PricingUnit {
  return unit === 'per_load' ? 'flat' : unit;
}

function maximumError(maximum: number | null, minimum: number | null): string | undefined {
  if (maximum === null) return undefined;
  if (Number.isNaN(maximum) || maximum <= 0) {
    return 'Enter the most a load can weigh in kg, like 6, or leave it blank.';
  }
  if (minimum !== null && !Number.isNaN(minimum) && maximum < minimum) {
    return 'The limit is lighter than the smallest load you charge for.';
  }
  return undefined;
}

/**
 * `table` is the owner's weight table, already checked row by row. Priced by
 * the table, the service keeps no single price or minimum of its own: the
 * first row is stored as the price its tile starts from. Its kg per load stays
 * as a label ("max 8 kg per load") and is optional; it never sets the price.
 */
export function validateServiceDraft(
  draft: ServiceDraft,
  table: readonly WeightPrice[] = []
): ServiceDraftResult {
  const byTable = draft.priceBy === 'table' && takesWeightTable(draft.unit);
  const name = draft.name.trim();
  const price = byTable ? (table[0]?.price ?? null) : parseNumber(draft.price);
  const minimum = draft.unit === 'per_kg' && !byTable ? parseNumber(draft.minQuantity) : null;
  const maximum = takesLoadLimit(draft.unit) ? parseNumber(draft.maxQuantity) : null;

  const errors: Partial<Record<ServiceDraftField, string>> = {};
  if (!name) errors.name = 'Name the service the way customers ask for it.';
  else if (name.length > NAME_LIMIT) errors.name = `Keep the name under ${NAME_LIMIT} characters.`;
  if (!draft.category) errors.category = 'Choose where it sits on your price list.';
  const unitProblem = chargeKindError(draft.unit, draft.category);
  if (unitProblem) errors.unit = unitProblem;
  if (byTable && table.length === 0) {
    errors.weightPrices = 'Add at least one row, like up to 8 kg ₱185.';
  } else if (!byTable) {
    const priceProblem = priceError(price);
    if (priceProblem) errors.price = priceProblem;
  }
  const minimumProblem = minimumError(minimum);
  if (minimumProblem) errors.minQuantity = minimumProblem;
  const maximumProblem =
    (byTable ? undefined : loadSizeError(draft.unit, maximum)) ?? maximumError(maximum, minimum);
  if (maximumProblem) errors.maxQuantity = maximumProblem;

  if (Object.keys(errors).length > 0 || !draft.category || !draft.unit || price === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      name,
      category: draft.category,
      unit: storedUnit(draft.unit),
      price: Math.round(price * 100) / 100,
      min_quantity: minimum ?? 0,
      max_quantity: maximum ?? 0,
      description: draft.description.trim(),
      weight_prices: byTable ? [...table] : [],
    },
  };
}

/** A saved service, opened for editing with every field changeable. */
export function draftFromService(service: {
  name: string;
  category: string;
  unit: PricingUnit;
  price: number;
  min_quantity: number;
  max_quantity?: number | null;
  description: string | null;
  weight_prices?: readonly WeightPrice[];
}): ServiceDraft {
  const isKnown = (CATEGORY_ORDER as readonly string[]).includes(service.category);
  const hasTable = (service.weight_prices?.length ?? 0) > 0;
  const isPerLoad =
    service.unit === 'flat' &&
    isWeighed({
      unit: service.unit,
      max_quantity: service.max_quantity ?? 0,
      category: service.category,
      weight_prices: service.weight_prices,
    });
  return {
    name: service.name,
    category: isKnown ? (service.category as ServiceCategory) : 'other',
    unit: isPerLoad ? 'per_load' : service.unit,
    // A ₱0 price is an unfinished row: show it empty so the field asks for one.
    price: service.price > 0 ? String(service.price) : '',
    minQuantity: service.min_quantity > 0 ? String(service.min_quantity) : '',
    maxQuantity: (service.max_quantity ?? 0) > 0 ? String(service.max_quantity) : '',
    description: service.description ?? '',
    ...(hasTable && service.unit !== 'per_item' ? { priceBy: 'table' as const } : {}),
  };
}

/**
 * Soaps, fabcons and bleach an owner might type as a "service". They belong on
 * the Add-ons shelf, where customers pick them per booking — on the price list
 * they become a service nobody books.
 */
const ADDON_WORDS = new Set([
  'tide',
  'ariel',
  'breeze',
  'surf',
  'champion',
  'downy',
  'zonrox',
  'detergent',
  'fabcon',
  'softener',
  'bleach',
  'sachet',
]);

export function looksLikeAddon(name: string): boolean {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((word) => ADDON_WORDS.has(word));
}

/** What the chosen unit means for the customer's bill. */
export function unitHelp(unit: ChargeKind): string {
  if (unit === 'per_kg') return 'You weigh the load and charge by the kilo.';
  if (unit === 'per_load') {
    return 'One price for each load. You weigh it at the counter, and heavier laundry is billed as more loads.';
  }
  if (unit === 'per_item') return 'You charge for each piece, like a comforter or a barong.';
  return 'One price for the whole job, whatever it weighs.';
}

/**
 * The load size worked through once with the owner's own figures, so "per
 * load" reads as a rule rather than a label: 9 kg at 4 kg a load is 3 loads.
 */
export function loadSizeExample(draft: Pick<ServiceDraft, 'maxQuantity' | 'price'>): string {
  const kg = Number(draft.maxQuantity.trim());
  if (draft.maxQuantity.trim() === '' || !Number.isFinite(kg) || kg <= 0) {
    return 'How much one load holds. Any weight you like.';
  }
  const heavier = Math.floor(kg * 2) + 1;
  const loads = Math.ceil(heavier / kg - 1e-9);
  const price = Number(draft.price.trim());
  const charge = draft.price.trim() !== '' && Number.isFinite(price) && price > 0
    ? ` = ${formatMoneyCompact(price * loads)}`
    : '';
  return `${heavier} kg is ${loads} loads${charge}.`;
}
