import { slugifyShopName } from './shop-slug';
import type { RandomInt } from './temp-password';
import { TEMP_PASSWORD_ALPHABET } from './temp-password';

export const MAX_USERNAME_LENGTH = 24;
export const MIN_USERNAME_LENGTH = 3;
const PASSWORD_RANDOM_LENGTH = 6;
const MAX_BRAND_WORD_LENGTH = 10;
const FALLBACK_BRAND = 'laundry';

const defaultRandomInt: RandomInt = (maxExclusive) =>
  Math.floor(Math.random() * maxExclusive);

export interface BrandedAccount {
  /** Login the shop signs in with, e.g. `sparklewash`. */
  username: string;
  /** Branded starter password, e.g. `Sparkle-x7K9q2`. */
  password: string;
}

/**
 * Auto-generates a login for a new laundry shop from its own branding:
 * the username is the shop name compacted, the password leads with the brand
 * word so the owner recognises it as theirs. The random tail keeps it
 * unguessable; the owner should change it after first sign-in.
 */
export function generateBrandedAccount(
  shopName: string,
  randomInt: RandomInt = defaultRandomInt
): BrandedAccount {
  const slug = slugifyShopName(shopName);
  const compact = slug.replace(/-/g, '');
  const hasLetter = /[a-z]/.test(compact);
  let usernameBase = hasLetter ? compact : `${FALLBACK_BRAND}${compact}`;
  // Auth usernames must be at least 3 characters (see the edge function's
  // USERNAME_RE); very short shop names get a laundry-flavoured pad.
  if (usernameBase.length < MIN_USERNAME_LENGTH) {
    usernameBase = `${usernameBase}wash`;
  }
  const username = usernameBase.slice(0, MAX_USERNAME_LENGTH);

  const firstWord = slug.split('-')[0] ?? '';
  const brandLetters = firstWord.replace(/[^a-z]/g, '').slice(0, MAX_BRAND_WORD_LENGTH);
  const brandWordSource = brandLetters || FALLBACK_BRAND;
  const brandWord = brandWordSource[0].toUpperCase() + brandWordSource.slice(1);

  const tail: string[] = [];
  for (let index = 0; index < PASSWORD_RANDOM_LENGTH; index += 1) {
    const draw = randomInt(TEMP_PASSWORD_ALPHABET.length);
    tail.push(TEMP_PASSWORD_ALPHABET[draw % TEMP_PASSWORD_ALPHABET.length]);
  }

  return { username, password: `${brandWord}-${tail.join('')}` };
}
