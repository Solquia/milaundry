// Temporary passwords get read over the phone or written on a slip of paper
// before the shop owner signs in for the first time, so the alphabet drops
// every glyph pair that is easy to confuse: 0/O, 1/l/I, 5/S, 8/B.
export const TEMP_PASSWORD_ALPHABET =
  'ACDEFGHJKMNPQRTUVWXYZacdefghjkmnpqrtuvwxyz234679';

export const TEMP_PASSWORD_LENGTH = 12;

/** Returns an integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

const defaultRandomInt: RandomInt = (maxExclusive) =>
  Math.floor(Math.random() * maxExclusive);

/**
 * Builds a temporary password for a freshly provisioned shop account.
 * The random source is injectable so the mapping is testable without stubbing
 * globals; production callers use the default.
 */
export function generateTempPassword(randomInt: RandomInt = defaultRandomInt): string {
  const characters: string[] = [];
  for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
    const draw = randomInt(TEMP_PASSWORD_ALPHABET.length);
    characters.push(TEMP_PASSWORD_ALPHABET[draw % TEMP_PASSWORD_ALPHABET.length]);
  }
  return characters.join('');
}
