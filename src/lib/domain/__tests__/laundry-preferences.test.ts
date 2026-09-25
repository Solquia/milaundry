import {
  NO_PREFERENCES,
  PREFERENCE_KEYS,
  formatBookingNotes,
  hasPreferences,
  limitToSupported,
  normalizePreferences,
  parseBookingNotes,
  preferenceLines,
  supportedPreferenceKeys,
  validatePreferences,
  type LaundryPreferences,
} from '../laundry-preferences';

const full: LaundryPreferences = {
  detergent: 'unscented',
  softener: 'with',
  separate_whites: true,
  delicates: true,
  air_dry: true,
  instructions: 'Fold the shirts, please',
};

describe('normalizePreferences', () => {
  it('returns no preferences for null, arrays and junk', () => {
    expect(normalizePreferences(null)).toEqual(NO_PREFERENCES);
    expect(normalizePreferences([])).toEqual(NO_PREFERENCES);
    expect(normalizePreferences('unscented')).toEqual(NO_PREFERENCES);
  });

  it('keeps known values and drops unknown ones', () => {
    expect(
      normalizePreferences({
        detergent: 'bleach',
        softener: 'with',
        separate_whites: 'yes',
        delicates: true,
        instructions: 42,
        extra: 'x',
      })
    ).toEqual({ ...NO_PREFERENCES, softener: 'with', delicates: true });
  });

  it('trims instructions', () => {
    expect(normalizePreferences({ instructions: '  cold wash ' }).instructions).toBe('cold wash');
  });
});

describe('supportedPreferenceKeys', () => {
  it('offers every preference when the shop has not said', () => {
    expect(supportedPreferenceKeys(null)).toEqual([...PREFERENCE_KEYS]);
    expect(supportedPreferenceKeys(undefined)).toEqual([...PREFERENCE_KEYS]);
  });

  it('keeps only known keys, in canonical order', () => {
    expect(supportedPreferenceKeys(['air_dry', 'ironing', 'detergent'])).toEqual([
      'detergent',
      'air_dry',
    ]);
  });

  it('offers nothing when the shop supports nothing', () => {
    expect(supportedPreferenceKeys([])).toEqual([]);
  });
});

describe('limitToSupported', () => {
  it('clears preferences the shop does not offer', () => {
    expect(limitToSupported(full, ['detergent', 'instructions'])).toEqual({
      ...NO_PREFERENCES,
      detergent: 'unscented',
      instructions: 'Fold the shirts, please',
    });
  });
});

describe('hasPreferences', () => {
  it('is false for the empty set and true once anything is chosen', () => {
    expect(hasPreferences(NO_PREFERENCES)).toBe(false);
    expect(hasPreferences({ ...NO_PREFERENCES, air_dry: true })).toBe(true);
    expect(hasPreferences({ ...NO_PREFERENCES, instructions: '  ' })).toBe(false);
  });
});

describe('preferenceLines', () => {
  it('says each chosen preference once, without the free text', () => {
    expect(preferenceLines(full)).toEqual([
      'Detergent: Unscented',
      'With fabric softener',
      'Separate whites',
      'Delicate items',
      'Air dry / hang dry',
    ]);
  });

  it('says no softener plainly', () => {
    expect(preferenceLines({ ...NO_PREFERENCES, softener: 'without' })).toEqual([
      'No fabric softener',
    ]);
  });
});

describe('validatePreferences', () => {
  it('accepts and trims', () => {
    expect(validatePreferences({ ...full, instructions: ' cold ' })).toEqual({
      ok: true,
      value: { ...full, instructions: 'cold' },
    });
  });

  it('rejects instructions over 200 characters', () => {
    const result = validatePreferences({ ...NO_PREFERENCES, instructions: 'x'.repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.instructions).toMatch(/200/);
  });
});

describe('booking notes', () => {
  it('writes preferences and rider notes as readable lines', () => {
    expect(formatBookingNotes({ preferences: full, riderNotes: 'Green gate' })).toBe(
      [
        'Detergent: Unscented',
        'With fabric softener',
        'Separate whites',
        'Delicate items',
        'Air dry / hang dry',
        'Instructions: Fold the shirts, please',
        'Rider: Green gate',
      ].join('\n')
    );
  });

  it('writes nothing when there is nothing to say', () => {
    expect(formatBookingNotes({ preferences: NO_PREFERENCES, riderNotes: ' ' })).toBe('');
  });

  it('flattens line breaks so the notes stay parseable', () => {
    const notes = formatBookingNotes({
      preferences: { ...NO_PREFERENCES, instructions: 'one\ntwo' },
      riderNotes: 'a\r\nb',
    });
    expect(notes).toBe('Instructions: one two\nRider: a b');
  });

  it('round-trips through the parser', () => {
    const notes = formatBookingNotes({ preferences: full, riderNotes: 'Green gate' });
    expect(parseBookingNotes(notes)).toEqual({ preferences: full, riderNotes: 'Green gate' });
  });

  it('keeps free-text notes from older bookings as instructions', () => {
    expect(parseBookingNotes('Please use cold water')).toEqual({
      preferences: { ...NO_PREFERENCES, instructions: 'Please use cold water' },
      riderNotes: '',
    });
  });

  it('parses empty notes to nothing', () => {
    expect(parseBookingNotes('')).toEqual({ preferences: NO_PREFERENCES, riderNotes: '' });
  });
});

describe('Philippine detergent and fabric conditioner brands', () => {
  const branded: LaundryPreferences = {
    ...NO_PREFERENCES,
    detergent: 'ariel',
    softener: 'downy',
  };

  it('keeps a known brand read back from the database', () => {
    expect(normalizePreferences({ detergent: 'breeze', softener: 'del' })).toEqual({
      ...NO_PREFERENCES,
      detergent: 'breeze',
      softener: 'del',
    });
  });

  it('drops a brand it does not know', () => {
    expect(normalizePreferences({ detergent: 'acme', softener: 'mystery' })).toEqual(NO_PREFERENCES);
  });

  it('writes the brand on the ticket by name', () => {
    expect(preferenceLines(branded)).toEqual([
      'Detergent: Ariel',
      'Fabric conditioner: Downy',
    ]);
  });

  it('reads a branded ticket back into the same preferences', () => {
    const notes = formatBookingNotes({ preferences: branded, riderNotes: '' });
    expect(parseBookingNotes(notes).preferences).toEqual(branded);
  });

  it('still reads tickets written before brands existed', () => {
    const notes = 'Detergent: Unscented\nWith fabric softener';
    expect(parseBookingNotes(notes).preferences).toMatchObject({
      detergent: 'unscented',
      softener: 'with',
    });
  });
});
