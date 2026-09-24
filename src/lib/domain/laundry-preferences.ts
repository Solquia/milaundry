/**
 * How a customer likes their laundry done, said once and carried to every
 * booking.
 *
 * The same person wants the same unscented detergent and the same air-dried
 * shirts on every load, and used to have to remember to type it into a note
 * each time — or, more often, to not bother and get the shop's default. The
 * preferences live in `customer_laundry_preferences`, readable by the customer
 * alone (never on `profiles`, which connected shops can read), and ride
 * onto each order as plain lines in `orders.notes`, which is the field every
 * shop screen and printed ticket already shows. No shop-side change is needed
 * for the counter to read them.
 *
 * Because the notes are the only copy on the order, they are written in a
 * fixed shape that `parseBookingNotes` can read back, so "Book again" reuses
 * last time's instructions instead of the customer's current defaults.
 *
 * A shop may not offer every one of these (a self-service laundromat does not
 * air-dry anything), so `shops.supported_preferences` lists what it does and
 * the booking only ever shows those.
 */

/** Canonical order: the order the booking card and the notes list them in. */
export const PREFERENCE_KEYS = [
  'detergent',
  'softener',
  'separate_whites',
  'delicates',
  'air_dry',
  'instructions',
] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export const DETERGENTS = ['regular', 'unscented', 'hypoallergenic', 'own'] as const;
export type Detergent = (typeof DETERGENTS)[number];

export const SOFTENER_CHOICES = ['with', 'without'] as const;
export type SoftenerChoice = (typeof SOFTENER_CHOICES)[number];

export const DETERGENT_LABELS: Record<Detergent, string> = {
  regular: 'Regular',
  unscented: 'Unscented',
  hypoallergenic: 'Hypoallergenic',
  own: "I'll bring my own",
};

export const SOFTENER_LABELS: Record<SoftenerChoice, string> = {
  with: 'With fabric softener',
  without: 'No fabric softener',
};

/** The three yes/no preferences, and how each reads on a ticket. */
export const TOGGLE_LABELS = {
  separate_whites: 'Separate whites',
  delicates: 'Delicate items',
  air_dry: 'Air dry / hang dry',
} as const;
export type TogglePreference = keyof typeof TOGGLE_LABELS;
const TOGGLES = Object.keys(TOGGLE_LABELS) as TogglePreference[];

export interface LaundryPreferences {
  /** Null: whatever the shop normally uses. */
  detergent: Detergent | null;
  /** Null: no preference either way. */
  softener: SoftenerChoice | null;
  separate_whites: boolean;
  delicates: boolean;
  air_dry: boolean;
  /** Free text for the washer, not the rider. */
  instructions: string;
}

export const NO_PREFERENCES: LaundryPreferences = Object.freeze({
  detergent: null,
  softener: null,
  separate_whites: false,
  delicates: false,
  air_dry: false,
  instructions: '',
});

export const INSTRUCTIONS_LIMIT = 200;

const DETERGENT_PREFIX = 'Detergent: ';
const INSTRUCTIONS_PREFIX = 'Instructions: ';
const RIDER_PREFIX = 'Rider: ';

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

/** One line, so a typed newline cannot break the notes into a fake preference. */
function oneLine(text: string): string {
  return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

/**
 * Whatever the database handed back, as preferences. The column is jsonb and
 * written by the client, so nothing about its shape is trusted.
 */
export function normalizePreferences(raw: unknown): LaundryPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_PREFERENCES };
  const row = raw as Record<string, unknown>;
  return {
    detergent: isOneOf(DETERGENTS, row.detergent) ? row.detergent : null,
    softener: isOneOf(SOFTENER_CHOICES, row.softener) ? row.softener : null,
    separate_whites: row.separate_whites === true,
    delicates: row.delicates === true,
    air_dry: row.air_dry === true,
    instructions: typeof row.instructions === 'string' ? row.instructions.trim() : '',
  };
}

/**
 * What this shop lets a customer ask for. A shop that has never said (or a
 * backend without the column yet) offers everything, which is what every shop
 * did before the column existed.
 */
export function supportedPreferenceKeys(
  shopKeys: readonly string[] | null | undefined
): PreferenceKey[] {
  if (!shopKeys) return [...PREFERENCE_KEYS];
  return PREFERENCE_KEYS.filter((key) => shopKeys.includes(key));
}

/** The preferences, with anything the shop does not offer cleared. */
export function limitToSupported(
  prefs: LaundryPreferences,
  supported: readonly PreferenceKey[]
): LaundryPreferences {
  const offers = (key: PreferenceKey) => supported.includes(key);
  return {
    detergent: offers('detergent') ? prefs.detergent : null,
    softener: offers('softener') ? prefs.softener : null,
    separate_whites: offers('separate_whites') && prefs.separate_whites,
    delicates: offers('delicates') && prefs.delicates,
    air_dry: offers('air_dry') && prefs.air_dry,
    instructions: offers('instructions') ? prefs.instructions : '',
  };
}

export function hasPreferences(prefs: LaundryPreferences): boolean {
  return preferenceLines(prefs).length > 0 || prefs.instructions.trim() !== '';
}

/** The chosen preferences as ticket lines. The free text is said separately. */
export function preferenceLines(prefs: LaundryPreferences): string[] {
  const lines: string[] = [];
  if (prefs.detergent) lines.push(`${DETERGENT_PREFIX}${DETERGENT_LABELS[prefs.detergent]}`);
  if (prefs.softener) lines.push(SOFTENER_LABELS[prefs.softener]);
  for (const key of TOGGLES) {
    if (prefs[key]) lines.push(TOGGLE_LABELS[key]);
  }
  return lines;
}

export type PreferencesResult =
  | { ok: true; value: LaundryPreferences }
  | { ok: false; errors: { instructions?: string } };

export function validatePreferences(prefs: LaundryPreferences): PreferencesResult {
  const instructions = prefs.instructions.trim();
  if (instructions.length > INSTRUCTIONS_LIMIT) {
    return {
      ok: false,
      errors: { instructions: `Keep instructions under ${INSTRUCTIONS_LIMIT} characters.` },
    };
  }
  return { ok: true, value: { ...prefs, instructions } };
}

export interface BookingNotes {
  preferences: LaundryPreferences;
  /** For whoever collects the laundry: gate codes, which floor. */
  riderNotes: string;
}

/** The order's notes: one preference per line, then the free text, then the rider's. */
export function formatBookingNotes({ preferences, riderNotes }: BookingNotes): string {
  const lines = preferenceLines(preferences);
  const instructions = oneLine(preferences.instructions);
  const rider = oneLine(riderNotes);
  if (instructions) lines.push(`${INSTRUCTIONS_PREFIX}${instructions}`);
  if (rider) lines.push(`${RIDER_PREFIX}${rider}`);
  return lines.join('\n');
}

const DETERGENT_BY_LABEL = new Map(
  DETERGENTS.map((key) => [DETERGENT_LABELS[key], key] as const)
);
const SOFTENER_BY_LINE = new Map(
  SOFTENER_CHOICES.map((key) => [SOFTENER_LABELS[key], key] as const)
);
const TOGGLE_BY_LINE = new Map<string, TogglePreference>(
  TOGGLES.map((key) => [TOGGLE_LABELS[key], key] as const)
);

/** The preferences one known line sets, or null when the line is not ours. */
function readPreferenceLine(line: string): Partial<LaundryPreferences> | null {
  if (line.startsWith(DETERGENT_PREFIX)) {
    const detergent = DETERGENT_BY_LABEL.get(line.slice(DETERGENT_PREFIX.length));
    return detergent ? { detergent } : null;
  }
  const softener = SOFTENER_BY_LINE.get(line);
  if (softener) return { softener };
  const toggle = TOGGLE_BY_LINE.get(line);
  if (toggle) return { [toggle]: true };
  return null;
}

/**
 * An order's notes, read back. Anything that is not one of our own lines — a
 * note typed on the web booking page, or before preferences existed — is kept
 * as instructions rather than thrown away.
 */
export function parseBookingNotes(notes: string): BookingNotes {
  let preferences: LaundryPreferences = { ...NO_PREFERENCES };
  const loose: string[] = [];
  let riderNotes = '';

  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(RIDER_PREFIX)) {
      riderNotes = line.slice(RIDER_PREFIX.length).trim();
      continue;
    }
    if (line.startsWith(INSTRUCTIONS_PREFIX)) {
      loose.push(line.slice(INSTRUCTIONS_PREFIX.length).trim());
      continue;
    }
    const known = readPreferenceLine(line);
    if (known) preferences = { ...preferences, ...known };
    else loose.push(line);
  }

  return { preferences: { ...preferences, instructions: loose.join(' ') }, riderNotes };
}
