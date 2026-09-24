/**
 * The customer's own book: the addresses they have named, and how they pay.
 *
 * A laundry customer orders from the same two or three places for years — home,
 * the office, their mother's — and pays the same way every time. The app used
 * to ask for all of it on every booking, which is how a rider ends up at the
 * wrong gate: not because anybody lied, but because the same address was typed
 * from memory for the ninth time.
 *
 * What this module decides is which saved address a booking should arrive
 * carrying, what counts as a usable one, and which payment methods need a
 * number beside them. The rules live here rather than in the two booking
 * screens and the profile screen that all ask them, because three copies of a
 * rule is two copies that will eventually disagree.
 *
 * There is nothing here about cards. `card` in this product is the terminal on
 * a shop's counter; nothing on file, nothing to store, nothing to leak.
 */
import { CUSTOMER_PAYMENT_METHODS, type PaymentMethod } from './walk-in-order';

/** A row of `public.customer_addresses`, as the app reads it. */
export interface SavedAddress {
  id: string;
  profile_id: string;
  label: string;
  address: string;
  /** Rider instructions: gate codes, which bell. Empty when the customer added none. */
  notes: string;
  /**
   * Where in the street (migration 0027). Optional on the type because a
   * backend without the migration returns rows without them; read them
   * through `formatAddressLine`, which treats a missing field as empty.
   */
  building?: string;
  unit?: string;
  landmark?: string;
  is_default: boolean;
  created_at: string;
}

/** The methods a customer may prefer. Cash means "at pickup or on delivery". */
export const PREFERRED_METHODS = CUSTOMER_PAYMENT_METHODS;
export type PreferredMethod = (typeof PREFERRED_METHODS)[number];

/** What the columns hold; checked here so a write never fails on length. */
const LIMITS = {
  label: 40,
  address: 300,
  notes: 200,
  building: 80,
  unit: 40,
  landmark: 120,
} as const;

/**
 * Default first, then newest.
 *
 * The default is the answer to "where is this going?" and belongs at the top
 * of any list that asks. Everything after it is ordered newest first: an
 * address added a minute ago is almost always the one being used now.
 */
export function sortAddresses(addresses: readonly SavedAddress[]): SavedAddress[] {
  return [...addresses].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * The address a booking should arrive carrying, or null when there is none.
 *
 * Falls back to the newest rather than to nothing: a customer with one saved
 * address who never marked it default still means that one.
 */
export function defaultAddress(addresses: readonly SavedAddress[]): SavedAddress | null {
  if (addresses.length === 0) return null;
  return sortAddresses(addresses)[0] ?? null;
}

/** Label and street together: two addresses both called "Home" still differ. */
export function addressPickerLabel(saved: SavedAddress): string {
  return `${saved.label} · ${saved.address}`;
}

/**
 * The one line a rider reads: unit and building ahead of the street, landmark
 * after it. This is what a booking sends as its delivery address, so the shop
 * gets the whole of it on the order without a second lookup.
 */
export function formatAddressLine(
  saved: Pick<SavedAddress, 'address' | 'building' | 'unit' | 'landmark'>
): string {
  const unit = (saved.unit ?? '').trim();
  const building = (saved.building ?? '').trim();
  const landmark = (saved.landmark ?? '').trim().replace(/^near\s+/i, '');
  const parts = [
    unit ? (/^unit\b/i.test(unit) ? unit : `Unit ${unit}`) : '',
    building,
    saved.address.trim(),
  ].filter(Boolean);
  const line = parts.join(', ');
  return landmark ? `${line} (near ${landmark})` : line;
}

function sameLine(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The saved address a booking's address line came from, or null for somewhere new. */
export function matchSavedAddress(
  addresses: readonly SavedAddress[],
  line: string
): SavedAddress | null {
  if (!line.trim()) return null;
  return addresses.find((saved) => sameLine(formatAddressLine(saved), line)) ?? null;
}

export interface AddressInput {
  label: string;
  address: string;
  /** Rider instructions. */
  notes: string;
  building?: string;
  unit?: string;
  landmark?: string;
}

/** A validated address: every field present, every field trimmed. */
export type CleanAddress = Required<AddressInput>;

export interface AddressErrors {
  label?: string;
  address?: string;
  notes?: string;
  building?: string;
  unit?: string;
  landmark?: string;
}

export type AddressResult =
  | { ok: true; value: CleanAddress }
  | { ok: false; errors: AddressErrors };

function tooLong(field: keyof typeof LIMITS): string {
  return `Keep this shorter than ${LIMITS[field]} characters.`;
}

/**
 * Whether this address can be saved, and what it saves as.
 *
 * The name is required because the picker is a row of names: an unnamed
 * address is a row the customer cannot tell from the next one.
 */
export function validateAddress(input: AddressInput): AddressResult {
  const label = input.label.trim();
  const address = input.address.trim();
  const notes = input.notes.trim();
  const building = (input.building ?? '').trim();
  const unit = (input.unit ?? '').trim();
  const landmark = (input.landmark ?? '').trim();
  const errors: AddressErrors = {};

  if (!label) errors.label = 'Give this address a name, like Home or Office.';
  else if (label.length > LIMITS.label) errors.label = tooLong('label');

  if (!address) errors.address = 'Enter the address the rider should go to.';
  else if (address.length > LIMITS.address) errors.address = tooLong('address');

  if (notes.length > LIMITS.notes) errors.notes = tooLong('notes');
  if (building.length > LIMITS.building) errors.building = tooLong('building');
  if (unit.length > LIMITS.unit) errors.unit = tooLong('unit');
  if (landmark.length > LIMITS.landmark) errors.landmark = tooLong('landmark');

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { label, address, notes, building, unit, landmark } };
}

/** Wallets are paid by sending to a number; cash and a transfer are not. */
export function needsHandle(method: PaymentMethod | null): boolean {
  return method === 'gcash' || method === 'maya';
}

export interface PaymentPreference {
  method: PreferredMethod | null;
  /** The wallet number, or '' for a method that does not carry one. */
  handle: string;
}

export interface PaymentPreferenceErrors {
  handle?: string;
}

export type PaymentPreferenceResult =
  | { ok: true; value: { method: PreferredMethod; handle: string } }
  | { ok: false; errors: PaymentPreferenceErrors };

/**
 * Whether a preference can be saved.
 *
 * A handle is kept only while the method that needs it is chosen. Switching
 * from GCash to cash and leaving the old number behind would put a wallet
 * number on a cash order, where the shop would read it as an instruction.
 */
export function validatePaymentPreference(input: {
  method: PreferredMethod;
  handle: string;
}): PaymentPreferenceResult {
  const handle = input.handle.trim();

  if (needsHandle(input.method) && !handle) {
    return {
      ok: false,
      errors: { handle: 'Enter the number this wallet pays from.' },
    };
  }

  return {
    ok: true,
    value: { method: input.method, handle: needsHandle(input.method) ? handle : '' },
  };
}

const METHOD_NAMES: Record<PreferredMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank transfer',
};

/** The one line under the heading: how this customer pays, said plainly. */
export function paymentPreferenceSummary(preference: PaymentPreference): string {
  if (!preference.method) return 'Not set yet';
  const name = METHOD_NAMES[preference.method];
  return preference.handle ? `${name} · ${preference.handle}` : name;
}

/** The name of one method, for a row in the chooser. */
export function methodName(method: PreferredMethod): string {
  return METHOD_NAMES[method];
}
