import { slugifyShopName } from './shop-slug';
import { TEMP_PASSWORD_WORDS, type RandomInt } from './temp-password';

export const MAX_USERNAME_LENGTH = 24;
export const MIN_USERNAME_LENGTH = 3;
const MAX_BRAND_WORD_LENGTH = 10;
const FALLBACK_BRAND = 'laundry';
const WORD_COUNT = TEMP_PASSWORD_WORDS.length;

const defaultRandomInt: RandomInt = (maxExclusive) =>
  Math.floor(Math.random() * maxExclusive);

export interface BrandedAccount {
  /** Login the shop signs in with, e.g. `sparklewash`. */
  username: string;
  /** Branded starter password, e.g. `Sparkle-soap-24`. */
  password: string;
}

/**
 * Auto-generates a login for a new laundry shop from its own branding:
 * the username is the shop name compacted, the password is the brand word,
 * one short laundry word, and a number — something you can say over the
 * phone. The owner should still change it after first sign-in.
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

  const word = TEMP_PASSWORD_WORDS[randomInt(WORD_COUNT) % WORD_COUNT];
  const number = 10 + (randomInt(90) % 90);

  return { username, password: `${brandWord}-${word}-${number}` };
}
