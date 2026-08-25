import { PH_DIAL_CODE, phoneInputToE164 } from './phone-input';

export const MAX_SHOP_NAME_LENGTH = 80;

export interface ShopFormValues {
  name: string;
  address: string;
  /** E.164, or '' when the shop has no contact number on file. */
  phone: string;
}

export type ShopFormField = 'name' | 'address' | 'phone';

export type ShopFormResult =
  | { ok: true; values: ShopFormValues }
  | { ok: false; field: ShopFormField; message: string };

export interface ShopFormInput {
  name: string;
  address: string;
  phoneInput: string;
}

/**
 * Validates the superadmin "add / edit laundry shop" form. The contact number
 * is optional — a shop can be registered before its number is known — but
 * anything typed must be a real mobile number so the handout stays useful.
 */
export function validateShopForm({
  name,
  address,
  phoneInput,
}: ShopFormInput): ShopFormResult {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, field: 'name', message: 'Enter the laundry shop name.' };
  }
  if (trimmedName.length > MAX_SHOP_NAME_LENGTH) {
    return {
      ok: false,
      field: 'name',
      message: `Shop name must be ${MAX_SHOP_NAME_LENGTH} characters or fewer.`,
    };
  }

  const trimmedPhoneInput = phoneInput.trim();
  let phone = '';
  if (trimmedPhoneInput) {
    const normalized = phoneInputToE164(trimmedPhoneInput);
    if (!normalized) {
      return {
        ok: false,
        field: 'phone',
        message: `Enter a valid mobile number (e.g. ${PH_DIAL_CODE} 917 123 4567), or leave it blank.`,
      };
    }
    phone = normalized;
  }

  return {
    ok: true,
    values: { name: trimmedName, address: address.trim(), phone },
  };
}
