import type { ShopAccountRole } from './shop-account';

export interface ShopMemberSummary {
  profile_id: string;
  role: ShopAccountRole;
}

export type RemovalCheck = { ok: true } | { ok: false; reason: string };

const ROLE_LABELS: Record<ShopAccountRole, string> = {
  owner: 'Owner',
  staff: 'Staff',
};

export function describeMemberRole(role: ShopAccountRole): string {
  return ROLE_LABELS[role];
}

/**
 * Guards the superadmin "remove account" action. A shop must always keep at
 * least one owner — otherwise nobody can run its dashboard and only a database
 * edit could recover it.
 */
export function canRemoveMember(
  members: readonly ShopMemberSummary[],
  profileId: string
): RemovalCheck {
  const target = members.find((member) => member.profile_id === profileId);
  if (!target) {
    return { ok: false, reason: 'That account is not a member of this shop.' };
  }

  if (target.role === 'owner') {
    const ownerCount = members.filter((member) => member.role === 'owner').length;
    if (ownerCount <= 1) {
      return {
        ok: false,
        reason:
          'This is the shop’s only owner. Add another owner before removing this one.',
      };
    }
  }

  return { ok: true };
}
