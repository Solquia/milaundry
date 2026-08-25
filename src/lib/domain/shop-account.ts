import { MIN_PASSWORD_LENGTH } from './credentials';
import { PH_DIAL_CODE, phoneInputToE164 } from './phone-input';

/**
 * Roles a superadmin can hand out *within a shop*. Deliberately excludes
 * 'superadmin' — platform admins are never provisioned through this form.
 */
export const SHOP_ACCOUNT_ROLES = ['owner', 'staff'] as const;

export type ShopAccountRole = (typeof SHOP_ACCOUNT_ROLES)[number];

const MIN_FULL_NAME_LENGTH = 2;

export interface NewShopAccount {
  fullName: string;
  /** E.164 — this is the account's real identity. */
  phone: string;
  password: string;
  role: ShopAccountRole;
}

export type ShopAccountField = 'fullName' | 'phone' | 'password' | 'role';

export type ShopAccountResult =
  | { ok: true; account: NewShopAccount }
  | { ok: false; field: ShopAccountField; message: string };

export interface ShopAccountInput {
  fullName: string;
  phoneInput: string;
  password: string;
  role: string;
}

function isShopAccountRole(value: string): value is ShopAccountRole {
  return (SHOP_ACCOUNT_ROLES as readonly string[]).includes(value);
}

/**
 * Validates the superadmin "create shop account" form before it is sent to the
 * provisioning Edge Function. Error messages never echo the password back.
 */
export function validateShopAccountForm({
  fullName,
  phoneInput,
  password,
  role,
}: ShopAccountInput): ShopAccountResult {
  const trimmedName = fullName.trim();
  if (trimmedName.length < MIN_FULL_NAME_LENGTH) {
    return {
      ok: false,
      field: 'fullName',
      message: "Enter the account holder's full name.",
    };
  }

  const phone = phoneInputToE164(phoneInput);
  if (!phone) {
    return {
      ok: false,
      field: 'phone',
      message: `Enter a valid mobile number (e.g. ${PH_DIAL_CODE} 917 123 4567).`,
    };
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      field: 'password',
      message: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (!isShopAccountRole(role)) {
    return { ok: false, field: 'role', message: 'Choose Owner or Staff.' };
  }

  return {
    ok: true,
    account: { fullName: trimmedName, phone, password, role },
  };
}
