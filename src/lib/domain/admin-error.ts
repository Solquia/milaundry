import { friendlyAuthError } from './auth-error';

// Superadmin actions fail through three different layers — Postgres RPCs, the
// provisioning Edge Function, and Supabase Auth — each with its own wording.
// This maps them onto messages a shop operator can act on, and reuses
// friendlyAuthError so synthetic auth emails can never reach the screen.

const NOT_ALLOWED_RE = /not allowed|permission denied|insufficient|forbidden|\b403\b/i;
const ALREADY_EXISTS_RE = /already registered|already exists|duplicate key|\b422\b/i;
const NOT_DEPLOYED_RE =
  /function not found|failed to send a request to the edge function|\b404\b/i;

export function friendlyAdminError(rawMessage: string, phone: string): string {
  if (!rawMessage.trim()) {
    return 'Something went wrong. Please try again.';
  }

  if (NOT_DEPLOYED_RE.test(rawMessage)) {
    return 'Account provisioning has not been deployed for this project yet. Deploy the admin-create-shop-account function, then try again.';
  }

  if (ALREADY_EXISTS_RE.test(rawMessage)) {
    return 'An account with this mobile number already exists. Assign the existing account to this shop instead.';
  }

  if (NOT_ALLOWED_RE.test(rawMessage)) {
    return 'Only a superadmin can manage laundry shops and their accounts.';
  }

  return friendlyAuthError(rawMessage, phone);
}
