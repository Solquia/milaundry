/**
 * What a shop sells on top of the wash: its soaps, its fabcons, its extras.
 *
 * The booking used to offer every customer the same free list of brands, which
 * promised things no counter had agreed to — a shop that only stocks Breeze was
 * being asked for Tide. Now each shop keeps its own shelf in `shop_addons`:
 * what it has, its own photo of it, what it charges for each one, how many
 * of it a booking may take, and whether a kind is pick-one or pick-several. A shop that has set up nothing still gets the free preference
 * tiles, so nobody loses the choice while their shelf is empty.
 *
 * The price here is only ever the estimate. `place_order_with_addons` reads
 * the same rows on the server and writes the lines itself, so what the
 * customer is charged is what the shop set, not what the phone sent.
 */
import { formatMoney } from './money';

export const ADDON_KINDS = ['detergent', 'fabcon', 'extra'] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];

export const ADDON_KIND_TITLES: Record<AddonKind, string> = {
  detergent: 'Sabon · Detergent',
  fabcon: 'Fabcon · Fabric conditioner',
  extra: 'Extras',
};

/**
 * The line under a group's title. Whether it says "one" or "as many" is the
 * shop's call — see `allowsMultiple` — so it is worded from that, not fixed.
 */
export function addonKindNote(kind: AddonKind, isMultiple: boolean): string {
  if (isMultiple) return 'Add as many as you like.';
  return kind === 'fabcon' ? 'Pick one for that just-bought smell.' : 'Pick one for this load.';
}

/** Short form, for merchant chips and ticket lines. */
export const ADDON_KIND_SHORT: Record<AddonKind, string> = {
  detergent: 'Detergent',
  fabcon: 'Fabcon',
  extra: 'Extra',
};

export interface ShopAddon {
  id: string;
  shop_id: string;
  kind: AddonKind;
  name: string;
  /** One line under the name: "Powder", "Per bag". */
  note: string;
  /** Flat, once per booking. Zero is free. */
  price: number;
  /** The shop's own photo of the product, when it has taken one. */
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  /** The most of this one item a customer may put on a booking. At least 1. */
  max_quantity: number;
}

/**
 * Per shop, per kind: may a customer pick more than one product of it? Kinds
 * the shop has not set let the customer pick as many as they like; the owner
 * can hold any kind to one.
 */
export type AddonGroupRules = Partial<Record<AddonKind, boolean>>;

/** How many of each add-on id are on the load. Absent means none. */
export type AddonPicks = Readonly<Record<string, number>>;

export interface PickedAddon {
  addon: ShopAddon;
  quantity: number;
}

export const ADDON_NAME_LIMIT = 40;
export const ADDON_PRICE_LIMIT = 10_000;
/** The most any shop may allow of one add-on per booking. The database agrees. */
export const ADDON_QUANTITY_LIMIT = 20;

export function allowsMultiple(kind: AddonKind, rules: AddonGroupRules): boolean {
  return rules[kind] ?? true;
}

function without(picks: AddonPicks, ids: ReadonlySet<string>): Record<string, number> {
  return Object.fromEntries(Object.entries(picks).filter(([id]) => !ids.has(id)));
}

/**
 * The picks after tapping `addon`. Tapping one that is on takes it off; one
 * that is not goes on at a count of one, replacing the rest of its kind when
 * the shop allows only one of that kind.
 */
export function pickAddon(
  picks: AddonPicks,
  addon: ShopAddon,
  catalog: readonly ShopAddon[],
  rules: AddonGroupRules
): Record<string, number> {
  if ((picks[addon.id] ?? 0) > 0) return without(picks, new Set([addon.id]));
  if (allowsMultiple(addon.kind, rules)) return { ...picks, [addon.id]: 1 };
  const sameKind = new Set(catalog.filter((row) => row.kind === addon.kind).map((row) => row.id));
  return { ...without(picks, sameKind), [addon.id]: 1 };
}

/** The picks with `addon` set to `quantity`, held to 0..its limit. Zero takes it off. */
export function setAddonQuantity(
  picks: AddonPicks,
  addon: ShopAddon,
  quantity: number
): Record<string, number> {
  const count = Math.max(0, Math.min(maxOf(addon), Math.floor(quantity)));
  if (count === 0) return without(picks, new Set([addon.id]));
  return { ...picks, [addon.id]: count };
}

function maxOf(addon: ShopAddon): number {
  return Math.max(1, Math.floor(addon.max_quantity || 1));
}

/**
 * The picked add-ons that still exist and are on offer, in the shop's order,
 * each count held to what the shop allows today.
 */
export function selectedAddons(catalog: readonly ShopAddon[], picks: AddonPicks): PickedAddon[] {
  return catalog
    .filter((row) => row.is_active && (picks[row.id] ?? 0) > 0)
    .map((row) => ({ addon: row, quantity: Math.min(maxOf(row), Math.floor(picks[row.id])) }));
}

export function addonsTotal(catalog: readonly ShopAddon[], picks: AddonPicks): number {
  const cents = selectedAddons(catalog, picks).reduce(
    (sum, { addon, quantity }) => sum + Math.round(addon.price * 100) * quantity,
    0
  );
  return cents / 100;
}

/** What the order sends: ids and counts. The server prices them from its own rows. */
export function addonPayload(picked: readonly PickedAddon[]): { id: string; quantity: number }[] {
  return picked.map(({ addon, quantity }) => ({ id: addon.id, quantity }));
}

export interface AddonGroup {
  kind: AddonKind;
  addons: ShopAddon[];
}

/** Active add-ons by kind, soap first, each group in the shop's own order. */
export function groupAddons(catalog: readonly ShopAddon[]): AddonGroup[] {
  return ADDON_KINDS.map((kind) => ({
    kind,
    addons: catalog
      .filter((row) => row.is_active && row.kind === kind)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  })).filter((group) => group.addons.length > 0);
}

/** The space between two product cards, across and down. */
export const SHELF_GAP = 8;
/** Narrower than this and the photo stops reading as a product. */
export const SHELF_MIN_CARD = 96;
const SHELF_MAX_COLUMNS = 4;
const SHELF_PHONE_COLUMNS = 3;

/**
 * How many product cards sit across a row `width` wide: as many as keep each
 * card at least `SHELF_MIN_CARD`, between two and four. A grid rather than a
 * sideways rail, so the whole shelf is on the page and nothing hides off the
 * right edge. Before the first measurement it assumes a phone.
 */
export function shelfColumns(width: number): number {
  if (!(width > 0)) return SHELF_PHONE_COLUMNS;
  const fits = Math.floor((width + SHELF_GAP) / (SHELF_MIN_CARD + SHELF_GAP));
  return Math.max(2, Math.min(SHELF_MAX_COLUMNS, fits));
}

export function addonPriceLabel(price: number): string {
  return price > 0 ? `+${formatMoney(price)}` : 'Free';
}

export type AddonDraftResult =
  | { ok: true; value: { name: string; price: number; max_quantity: number } }
  | { ok: false; errors: { name?: string; price?: string; maxQuantity?: string } };

/** A merchant's typed name, price and limit, checked before anything is saved. */
export function validateAddonDraft(draft: {
  name: string;
  price: string;
  maxQuantity: string;
}): AddonDraftResult {
  const name = draft.name.trim();
  const priceText = draft.price.trim();
  const price = priceText === '' ? 0 : Number(priceText);
  const maxText = draft.maxQuantity.trim();
  const maxQuantity = maxText === '' ? 1 : Number(maxText);
  const errors: { name?: string; price?: string; maxQuantity?: string } = {};

  if (!name) errors.name = 'Give it a name customers will recognise.';
  else if (name.length > ADDON_NAME_LIMIT) {
    errors.name = `Keep the name under ${ADDON_NAME_LIMIT} characters.`;
  }
  if (!Number.isFinite(price) || price < 0) errors.price = 'Enter a price of zero or more.';
  else if (price > ADDON_PRICE_LIMIT) errors.price = 'That price looks too high for an add-on.';
  if (!Number.isInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > ADDON_QUANTITY_LIMIT) {
    errors.maxQuantity = `Allow a whole number from 1 to ${ADDON_QUANTITY_LIMIT}.`;
  }

  if (errors.name || errors.price || errors.maxQuantity) return { ok: false, errors };
  return {
    ok: true,
    value: { name, price: Math.round(price * 100) / 100, max_quantity: maxQuantity },
  };
}

/** A scoop of powder and a sachet of fabcon at a typical Metro Manila counter. */
export const STARTER_DETERGENT_PRICE = 15;
export const STARTER_FABCON_PRICE = 10;

/**
 * The shelf a new shop can start from: the soaps and fabcons most laundries in
 * the Philippines stock, at a going rate the owner can change on the Prices tab.
 */
export const STARTER_ADDONS: readonly { kind: AddonKind; name: string; note: string; price: number }[] = [
  { kind: 'detergent', name: 'Ariel', note: 'Powder', price: STARTER_DETERGENT_PRICE },
  { kind: 'detergent', name: 'Tide', note: 'Powder', price: STARTER_DETERGENT_PRICE },
  { kind: 'detergent', name: 'Breeze', note: 'Powder', price: STARTER_DETERGENT_PRICE },
  { kind: 'detergent', name: 'Surf', note: 'Powder', price: STARTER_DETERGENT_PRICE },
  { kind: 'detergent', name: 'Champion', note: 'Powder', price: STARTER_DETERGENT_PRICE },
  { kind: 'fabcon', name: 'Downy', note: 'Fabric conditioner', price: STARTER_FABCON_PRICE },
  { kind: 'fabcon', name: 'Surf Fabcon', note: 'Fabric conditioner', price: STARTER_FABCON_PRICE },
  { kind: 'fabcon', name: 'Del', note: 'Fabric conditioner', price: STARTER_FABCON_PRICE },
];
