/**
 * An owner cutting a key for the counter.
 *
 * Staff logins existed before this, but only a MiLaundry superadmin could
 * create one — so a shop taking on a new hire had to email us and wait. An
 * owner who cannot add their own staff either works the counter themselves or
 * hands out their own password, and the second is what actually happens.
 *
 * The safety property is the shape of this module rather than a check inside
 * it: **there is no role argument anywhere in the flow.** An owner who could
 * pass a role could pass `owner`, and a staff login that could add staff is a
 * key-cutting machine. So the role is a constant here, the Edge Function
 * refuses anything else from a merchant caller, and `owner_attach_shop_staff`
 * hardcodes the same word a third time. Three layers, one sentence.
 */
import { normalizePhone } from './phone';
import type { ShopAccountRole } from './shop-account';

/**
 * The only role an owner may ever mint. Deliberately not a parameter — see the
 * note above; the database function takes no role either.
 */
export const STAFF_ONLY_ROLE = 'staff' as const;

/** Who may open the "Add staff" card. Owners only; staff cannot clone themselves. */
export function canAddStaff(role: ShopAccountRole): boolean {
  return role === 'owner';
}

export interface StaffDraft {
  fullName: string;
  phone: string;
}

export type StaffDraftErrors = Partial<Record<'fullName' | 'phone', string>>;

export type StaffDraftResult =
  | { ok: true; value: StaffDraft }
  | { ok: false; errors: StaffDraftErrors };

/** Shortest name worth putting on an order. Initials are two characters. */
const MIN_NAME_LENGTH = 2;

/**
 * The new hire, checked.
 *
 * Both problems are reported together. A form that reveals its objections one
 * at a time makes the owner submit three times to learn three things, and this
 * one is filled in while somebody waits at the counter.
 */
export function validateStaffDraft(draft: StaffDraft): StaffDraftResult {
  const errors: StaffDraftErrors = {};

  const fullName = draft.fullName.trim();
  if (fullName.length < MIN_NAME_LENGTH) {
    // The name is what the orders list shows against whoever took the order,
    // so it is the shop's own record, not a formality.
    errors.fullName = 'Enter the name this person is known by in the shop.';
  }

  const phone = normalizePhone(draft.phone);
  if (!phone) {
    errors.phone = 'Enter their mobile number, e.g. 0917 123 4567.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, value: { fullName, phone: phone as string } };
}
