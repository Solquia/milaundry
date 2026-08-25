import { PH_DIAL_CODE, formatPhoneInput, phoneInputToE164 } from './phone-input';

// The message the superadmin hands to a laundry shop after creating their
// login. Kept as data (title/lines/note) so the screen can render it and a
// future share/copy action can join the lines.

export interface CredentialsHandoffInput {
  fullName: string;
  phone: string;
  password: string;
}

export interface CredentialsHandoff {
  title: string;
  lines: string[];
  note: string;
}

function displayPhone(phone: string): string {
  if (!phoneInputToE164(phone)) return phone;
  return `${PH_DIAL_CODE} ${formatPhoneInput(phone)}`;
}

export function credentialsHandoff({
  fullName,
  phone,
  password,
}: CredentialsHandoffInput): CredentialsHandoff {
  return {
    title: `Account created for ${fullName.trim()}`,
    lines: [
      `Mobile number: ${displayPhone(phone)}`,
      `Temporary password: ${password}`,
    ],
    note: 'Send these to them privately — they can sign in right away and should change the password after.',
  };
}
