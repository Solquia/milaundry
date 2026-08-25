import { generateBrandedAccount } from '../branded-account';

// Deterministic "random": always picks index 0 ('A' in the temp alphabet).
const zeroRandom = () => 0;

describe('generateBrandedAccount', () => {
  it('derives the username from the shop name branding', () => {
    const account = generateBrandedAccount('Sparkle Wash', zeroRandom);
    expect(account.username).toBe('sparklewash');
  });

  it('builds a password from the brand word plus random characters', () => {
    const account = generateBrandedAccount('Sparkle Wash', zeroRandom);
    expect(account.password).toBe('Sparkle-AAAAAA');
    expect(account.password.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps usernames within 24 characters', () => {
    const account = generateBrandedAccount(
      'Super Extremely Long Laundromat Business Name',
      zeroRandom
    );
    expect(account.username.length).toBeLessThanOrEqual(24);
  });

  it('always includes a letter so usernames never collide with phone logins', () => {
    const account = generateBrandedAccount('123', zeroRandom);
    expect(account.username).toMatch(/[a-z]/);
  });

  it('falls back to laundry branding when the name is unusable', () => {
    const account = generateBrandedAccount('!!!', zeroRandom);
    expect(account.username).toMatch(/^laundry/);
    expect(account.password.startsWith('Laundry-')).toBe(true);
  });
});
