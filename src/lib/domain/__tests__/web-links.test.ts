import {
  DEFAULT_WEB_HOST,
  acceptedHosts,
  claimUrl,
  joinUrl,
  normalizeHost,
  storefrontUrl,
  webHost,
} from '../web-links';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const TOKEN = '8f14e45f-ceea-467a-9b1c-2d3e4f5a6b7c';

describe('normalizeHost', () => {
  it('strips the scheme, path and trailing slash a person might paste', () => {
    expect(normalizeHost('https://wash.example.ph/')).toBe('wash.example.ph');
    expect(normalizeHost('http://localhost:8081/s/x')).toBe('localhost:8081');
    expect(normalizeHost('  Milaundry.App ')).toBe('milaundry.app');
  });

  it('returns null for an empty or nonsense value', () => {
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
    expect(normalizeHost('https://')).toBeNull();
  });
});

describe('webHost', () => {
  it('falls back to the default host when the env is unset or blank', () => {
    expect(webHost(undefined)).toBe(DEFAULT_WEB_HOST);
    expect(webHost('')).toBe(DEFAULT_WEB_HOST);
  });

  it('uses the configured host', () => {
    expect(webHost('https://laundry.example.ph')).toBe('laundry.example.ph');
  });
});

describe('links', () => {
  it('builds the storefront link from the slug', () => {
    expect(storefrontUrl('sparkle-wash', 'milaundry.app')).toBe(
      'https://milaundry.app/s/sparkle-wash'
    );
  });

  it('builds the counter and receipt links with the token encoded', () => {
    expect(joinUrl(SHOP_ID, TOKEN, 'milaundry.app')).toBe(
      `https://milaundry.app/join/${SHOP_ID}?token=${TOKEN}`
    );
    expect(claimUrl(ORDER_ID, 'a b', 'milaundry.app')).toBe(
      `https://milaundry.app/claim/${ORDER_ID}?token=a%20b`
    );
  });
});

describe('acceptedHosts', () => {
  it('always keeps the default host so printed codes survive a host change', () => {
    expect(acceptedHosts('laundry.example.ph')).toEqual(['laundry.example.ph', DEFAULT_WEB_HOST]);
  });

  it('does not list the default host twice', () => {
    expect(acceptedHosts(DEFAULT_WEB_HOST)).toEqual([DEFAULT_WEB_HOST]);
  });
});
