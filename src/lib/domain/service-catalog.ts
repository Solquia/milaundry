import type { PricingUnit } from './pricing';

export const CATEGORY_ORDER = [
  'wash_fold',
  'ironing',
  'dry_cleaning',
  'special_items',
  'self_service',
  'other',
] as const;

export type ServiceCategory = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  wash_fold: 'Wash & Fold',
  ironing: 'Ironing & Press',
  dry_cleaning: 'Dry Cleaning',
  special_items: 'Bedding & Heavy Items',
  self_service: 'Self-Service',
  other: 'Other Services',
};

/**
 * The same categories, short enough to wear as a chip.
 *
 * The full labels run to "Bedding & Heavy Items", which wraps twice in the
 * corner of a card sitting two to a row on a phone. These are for the corner
 * of a card; `CATEGORY_LABELS` stays the name a heading uses.
 */
export const CATEGORY_SHORT: Record<ServiceCategory, string> = {
  wash_fold: 'Wash & Fold',
  ironing: 'Ironing',
  dry_cleaning: 'Dry Clean',
  special_items: 'Bedding',
  self_service: 'Self-Serve',
  other: 'Other',
};

export interface CategorizedService {
  category: ServiceCategory;
}

export interface ServiceGroup<T extends CategorizedService> {
  category: ServiceCategory;
  services: T[];
}

/** Groups services into non-empty category buckets in canonical order. */
export function groupServicesByCategory<T extends CategorizedService>(
  services: readonly T[]
): ServiceGroup<T>[] {
  const known = new Set<ServiceCategory>(CATEGORY_ORDER);
  return CATEGORY_ORDER.map((category) => ({
    category,
    services: services.filter((service) =>
      category === 'other'
        ? service.category === 'other' || !known.has(service.category)
        : service.category === category
    ),
  })).filter((group) => group.services.length > 0);
}

export interface RemovableService {
  is_active: boolean;
}

/**
 * Splits a shop's price list into what customers can order and what the owner
 * has taken off the list. Removed services are kept so a mistaken removal can
 * be undone rather than forcing the owner to retype the service.
 */
export function splitServicesByStatus<T extends RemovableService>(
  services: readonly T[]
): { active: T[]; removed: T[] } {
  const active: T[] = [];
  const removed: T[] = [];
  for (const service of services) {
    (service.is_active ? active : removed).push(service);
  }
  return { active, removed };
}

export interface StarterService {
  name: string;
  category: ServiceCategory;
  unit: PricingUnit;
  price: number;
  /** Minimum billable kilos; 0 for non-per-kg services. */
  min_quantity: number;
  description: string;
}

/**
 * One-tap starting price list covering the usual PH laundromat selling
 * styles. Owners are expected to edit prices to match their shop.
 */
export const STARTER_SERVICES: readonly StarterService[] = [
  {
    name: 'Wash, Dry & Fold',
    category: 'wash_fold',
    unit: 'per_kg',
    price: 35,
    min_quantity: 5,
    description: 'Regular clothes, machine wash and fold. 5 kg minimum.',
  },
  {
    name: 'Wash, Dry & Iron',
    category: 'wash_fold',
    unit: 'per_kg',
    price: 55,
    min_quantity: 5,
    description: 'Wash and fold plus pressing. 5 kg minimum.',
  },
  {
    name: 'Ironing only',
    category: 'ironing',
    unit: 'per_item',
    price: 20,
    min_quantity: 0,
    description: 'Pressing per garment.',
  },
  {
    name: 'Dry cleaning — Barong / Suit',
    category: 'dry_cleaning',
    unit: 'per_item',
    price: 280,
    min_quantity: 0,
    description: 'Delicate garment dry cleaning.',
  },
  {
    name: 'Dry cleaning — Gown',
    category: 'dry_cleaning',
    unit: 'per_item',
    price: 380,
    min_quantity: 0,
    description: 'Formal gowns and dresses.',
  },
  {
    name: 'Comforter / Blanket (single)',
    category: 'special_items',
    unit: 'per_item',
    price: 180,
    min_quantity: 0,
    description: 'Single-size comforters, blankets, and bed sheets.',
  },
  {
    name: 'Comforter (queen / king, thick)',
    category: 'special_items',
    unit: 'per_item',
    price: 280,
    min_quantity: 0,
    description: 'Thick or oversized comforters and duvets.',
  },
  {
    name: 'Curtains',
    category: 'special_items',
    unit: 'per_kg',
    price: 60,
    min_quantity: 3,
    description: 'Curtains and heavy drapery, priced by weight. 3 kg minimum.',
  },
  {
    name: 'Self-service wash (per load)',
    category: 'self_service',
    unit: 'flat',
    price: 75,
    min_quantity: 0,
    description: 'Customer-operated washer, one load.',
  },
  {
    name: 'Self-service dry (per load)',
    category: 'self_service',
    unit: 'flat',
    price: 75,
    min_quantity: 0,
    description: 'Customer-operated dryer, one load.',
  },
];
