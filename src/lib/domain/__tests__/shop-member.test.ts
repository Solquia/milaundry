import { canRemoveMember, describeMemberRole } from '../shop-member';

const OWNER = { profile_id: 'owner-1', role: 'owner' as const };
const SECOND_OWNER = { profile_id: 'owner-2', role: 'owner' as const };
const STAFF = { profile_id: 'staff-1', role: 'staff' as const };

describe('describeMemberRole', () => {
  it('labels an owner', () => {
    expect(describeMemberRole('owner')).toBe('Owner');
  });

  it('labels staff', () => {
    expect(describeMemberRole('staff')).toBe('Staff');
  });
});

describe('canRemoveMember', () => {
  it('allows removing staff while an owner remains', () => {
    expect(canRemoveMember([OWNER, STAFF], 'staff-1')).toEqual({ ok: true });
  });

  it('allows removing an owner when another owner remains', () => {
    expect(canRemoveMember([OWNER, SECOND_OWNER], 'owner-1')).toEqual({ ok: true });
  });

  it('refuses to remove the only owner, leaving the shop unmanaged', () => {
    const result = canRemoveMember([OWNER, STAFF], 'owner-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/owner/i);
  });

  it('refuses to remove the only owner even when they are the only member', () => {
    expect(canRemoveMember([OWNER], 'owner-1').ok).toBe(false);
  });

  it('refuses to remove somebody who is not a member of the shop', () => {
    const result = canRemoveMember([OWNER, STAFF], 'stranger');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not a member/i);
  });

  it('refuses to remove anybody from an empty member list', () => {
    expect(canRemoveMember([], 'owner-1').ok).toBe(false);
  });

  it('does not mutate the member list it is given', () => {
    const members = [OWNER, STAFF];
    const snapshot = JSON.parse(JSON.stringify(members));

    canRemoveMember(members, 'staff-1');

    expect(members).toEqual(snapshot);
  });
});
