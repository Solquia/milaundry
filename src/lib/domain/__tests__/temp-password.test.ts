import { MIN_PASSWORD_LENGTH } from '../credentials';
import {
  TEMP_PASSWORD_WORDS,
  generateTempPassword,
  isPasswordSource,
} from '../temp-password';

const SHAPE = /^([a-z]+)-([a-z]+)-(\d{2})$/;

describe('generateTempPassword', () => {
  it('is two different list words and a two-digit number', () => {
    const password = generateTempPassword();
    const match = password.match(SHAPE);
    expect(match).not.toBeNull();
    if (!match) return;
    expect(TEMP_PASSWORD_WORDS).toContain(match[1]);
    expect(TEMP_PASSWORD_WORDS).toContain(match[2]);
    expect(match[1]).not.toBe(match[2]);
    const number = Number(match[3]);
    expect(number).toBeGreaterThanOrEqual(10);
    expect(number).toBeLessThanOrEqual(99);
  });

  it('meets the shared minimum password length', () => {
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
  });

  it('is deterministic when given a deterministic random source', () => {
    const alwaysFirst = () => 0;
    expect(generateTempPassword(alwaysFirst)).toBe(
      `${TEMP_PASSWORD_WORDS[0]}-${TEMP_PASSWORD_WORDS[1]}-10`
    );
  });

  it('maps successive draws to first word, second word, then the number', () => {
    let call = 0;
    const sequence = [2, 5, 14];
    const scripted = () => sequence[call++] ?? 0;
    expect(generateTempPassword(scripted)).toBe(
      `${TEMP_PASSWORD_WORDS[2]}-${TEMP_PASSWORD_WORDS[5]}-${10 + 14}`
    );
  });

  it('bumps a repeated second word so the pair is not the same word twice', () => {
    const alwaysZero = () => 0;
    const [, second] = generateTempPassword(alwaysZero).split('-');
    expect(second).toBe(TEMP_PASSWORD_WORDS[1]);
  });

  it('asks the random source within the word list and 90 for the number', () => {
    const seen: number[] = [];
    generateTempPassword((maxExclusive) => {
      seen.push(maxExclusive);
      return 0;
    });
    expect(seen).toEqual([TEMP_PASSWORD_WORDS.length, TEMP_PASSWORD_WORDS.length, 90]);
  });

  it('produces different passwords across calls with the default random source', () => {
    const generated = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(generated.size).toBeGreaterThan(1);
  });
});

describe('isPasswordSource', () => {
  it('accepts generate or choose and nothing else', () => {
    expect(isPasswordSource('generate')).toBe(true);
    expect(isPasswordSource('choose')).toBe(true);
    expect(isPasswordSource('random')).toBe(false);
  });
});
