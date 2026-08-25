import { MIN_PASSWORD_LENGTH } from '../credentials';
import {
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
  generateTempPassword,
} from '../temp-password';

describe('TEMP_PASSWORD_LENGTH', () => {
  it('is at least the shared minimum password length', () => {
    expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
  });
});

describe('TEMP_PASSWORD_ALPHABET', () => {
  it('excludes characters that are ambiguous when read aloud or written down', () => {
    for (const ambiguous of ['0', 'O', '1', 'l', 'I']) {
      expect(TEMP_PASSWORD_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('contains no duplicate characters', () => {
    expect(new Set(TEMP_PASSWORD_ALPHABET).size).toBe(TEMP_PASSWORD_ALPHABET.length);
  });
});

describe('generateTempPassword', () => {
  it('produces a password of the configured length', () => {
    expect(generateTempPassword()).toHaveLength(TEMP_PASSWORD_LENGTH);
  });

  it('produces a password drawn only from the alphabet', () => {
    for (const character of generateTempPassword()) {
      expect(TEMP_PASSWORD_ALPHABET).toContain(character);
    }
  });

  it('is deterministic when given a deterministic random source', () => {
    const alwaysFirst = () => 0;

    expect(generateTempPassword(alwaysFirst)).toBe(
      TEMP_PASSWORD_ALPHABET[0].repeat(TEMP_PASSWORD_LENGTH)
    );
  });

  it('maps each random draw to the matching alphabet index', () => {
    let call = 0;
    const ascending = () => call++;

    expect(generateTempPassword(ascending)).toBe(
      TEMP_PASSWORD_ALPHABET.slice(0, TEMP_PASSWORD_LENGTH)
    );
  });

  it('asks the random source for an index within the alphabet bounds', () => {
    const seen: number[] = [];
    generateTempPassword((maxExclusive) => {
      seen.push(maxExclusive);
      return 0;
    });

    expect(seen).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(new Set(seen)).toEqual(new Set([TEMP_PASSWORD_ALPHABET.length]));
  });

  it('produces different passwords across calls with the default random source', () => {
    const generated = new Set(Array.from({ length: 20 }, () => generateTempPassword()));

    expect(generated.size).toBeGreaterThan(1);
  });
});
