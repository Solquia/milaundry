import type { Role } from './splash-gate';

/** The login created to open the existing admin console. */
export const BOOTSTRAP_ADMIN_PHONE = '+639170000099';

export const BOOTSTRAP_ADMIN_SQL = `update public.profiles
set role = 'superadmin'
where phone = '${BOOTSTRAP_ADMIN_PHONE}';`;

export const BOOTSTRAP_ADMIN_SQL_URL =
  'https://supabase.com/dashboard/project/gnfxeacouyfrfnxkjubn/sql/new';

/** True when this account is the bootstrap login and has not been promoted yet. */
export function needsAdminBootstrap(profile: {
  phone: string;
  role: Role | null | undefined;
} | null): boolean {
  return Boolean(
    profile && profile.phone === BOOTSTRAP_ADMIN_PHONE && profile.role === 'customer'
  );
}
