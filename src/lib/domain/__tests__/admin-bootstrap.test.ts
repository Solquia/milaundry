import {
  BOOTSTRAP_ADMIN_PHONE,
  BOOTSTRAP_ADMIN_SQL,
  needsAdminBootstrap,
} from '../admin-bootstrap';

describe('needsAdminBootstrap', () => {
  it('asks the bootstrap login to finish promotion while it is still a customer', () => {
    expect(
      needsAdminBootstrap({ phone: BOOTSTRAP_ADMIN_PHONE, role: 'customer' })
    ).toBe(true);
  });

  it('leaves a promoted admin and every other account alone', () => {
    expect(
      needsAdminBootstrap({ phone: BOOTSTRAP_ADMIN_PHONE, role: 'superadmin' })
    ).toBe(false);
    expect(needsAdminBootstrap({ phone: '+639171234567', role: 'customer' })).toBe(false);
    expect(needsAdminBootstrap(null)).toBe(false);
  });

  it('names this exact phone in the SQL so the wrong row cannot be updated', () => {
    expect(BOOTSTRAP_ADMIN_SQL).toContain(BOOTSTRAP_ADMIN_PHONE);
    expect(BOOTSTRAP_ADMIN_SQL).toMatch(/role = 'superadmin'/);
  });
});
