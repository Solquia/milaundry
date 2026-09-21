import { MIN_PASSWORD_LENGTH } from './credentials';

/**
 * Temporary passwords are read over the phone or written on a slip, so they
 * are two short words and a number — not a 12-character soup of mixed case.
 * Words stay lowercase and unaccented so they type the same as they sound.
 */
export const TEMP_PASSWORD_WORDS = [
  'blue',
  'clean',
  'fresh',
  'soft',
  'warm',
  'quick',
  'soap',
  'wash',
  'fold',
  'steam',
  'press',
  'load',
] as const;

export type TempPasswordWord = (typeof TEMP_PASSWORD_WORDS)[number];

/** How a superadmin sets the first password: invent one, or type their own. */
export type PasswordSource = 'generate' | 'choose';

export const PASSWORD_SOURCES: readonly PasswordSource[] = ['generate', 'choose'];

/** Returns an integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

const defaultRandomInt: RandomInt = (maxExclusive) =>
  Math.floor(Math.random() * maxExclusive);

const WORD_COUNT = TEMP_PASSWORD_WORDS.length;

/**
 * `fresh-soap-24` — two different words from the list and a number 10–99.
 * Always at least `MIN_PASSWORD_LENGTH` characters.
 */
export function generateTempPassword(randomInt: RandomInt = defaultRandomInt): string {
  const firstIndex = randomInt(WORD_COUNT) % WORD_COUNT;
  let secondIndex = randomInt(WORD_COUNT) % WORD_COUNT;
  if (secondIndex === firstIndex) {
    secondIndex = (firstIndex + 1) % WORD_COUNT;
  }
  const number = 10 + (randomInt(90) % 90);
  const password = `${TEMP_PASSWORD_WORDS[firstIndex]}-${TEMP_PASSWORD_WORDS[secondIndex]}-${number}`;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('generated password shorter than the shared minimum');
  }
  return password;
}

export function isPasswordSource(value: string): value is PasswordSource {
  return (PASSWORD_SOURCES as readonly string[]).includes(value);
}
