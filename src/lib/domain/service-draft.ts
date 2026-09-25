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
import { CATEGORY_ORDER, type ServiceCategory } from './service-catalog';
import type { PricingUnit } from './pricing';

export interface ServiceDraft {
  name: string;
  category: ServiceCategory | null;
  unit: PricingUnit | null;
  price: string;
  minQuantity: string;
  description: string;
}

export type ServiceDraftField = 'name' | 'category' | 'unit' | 'price' | 'minQuantity';

export interface ServiceValues {
  name: string;
  category: ServiceCategory;
  unit: PricingUnit;
  price: number;
  min_quantity: number;
  description: string;
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

export function validateServiceDraft(draft: ServiceDraft): ServiceDraftResult {
  const name = draft.name.trim();
  const price = parseNumber(draft.price);
  const minimum = draft.unit === 'per_kg' ? parseNumber(draft.minQuantity) : null;

  const errors: Partial<Record<ServiceDraftField, string>> = {};
  if (!name) errors.name = 'Name the service the way customers ask for it.';
  else if (name.length > NAME_LIMIT) errors.name = `Keep the name under ${NAME_LIMIT} characters.`;
  if (!draft.category) errors.category = 'Choose where it sits on your price list.';
  if (!draft.unit) errors.unit = 'Choose how you charge for it.';
  const priceProblem = priceError(price);
  if (priceProblem) errors.price = priceProblem;
  const minimumProblem = minimumError(minimum);
  if (minimumProblem) errors.minQuantity = minimumProblem;

  if (Object.keys(errors).length > 0 || !draft.category || !draft.unit || price === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      name,
      category: draft.category,
      unit: draft.unit,
      price: Math.round(price * 100) / 100,
      min_quantity: minimum ?? 0,
      description: draft.description.trim(),
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
  description: string | null;
}): ServiceDraft {
  const isKnown = (CATEGORY_ORDER as readonly string[]).includes(service.category);
  return {
    name: service.name,
    category: isKnown ? (service.category as ServiceCategory) : 'other',
    unit: service.unit,
    // A ₱0 price is an unfinished row: show it empty so the field asks for one.
    price: service.price > 0 ? String(service.price) : '',
    minQuantity: service.min_quantity > 0 ? String(service.min_quantity) : '',
    description: service.description ?? '',
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
export function unitHelp(unit: PricingUnit): string {
  if (unit === 'per_kg') return 'You weigh the load and charge by the kilo.';
  if (unit === 'per_item') return 'You charge for each piece, like a comforter or a barong.';
  return 'One price for the whole job, whatever it weighs.';
}
