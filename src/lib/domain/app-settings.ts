/**
 * The preferences a customer can set for themselves.
 *
 * Three booleans, and deliberately no more. Every toggle here changes
 * something the app actually does — the phone taps back or it does not, a row
 * reaches the feed or it does not — so there is no switch that only looks like
 * a choice. A settings screen full of inert controls teaches people that
 * settings do not work.
 *
 * Storage is a device-local JSON blob written by `lib/settings-store`, so
 * every value that comes back has to be treated as something a previous
 * version of the app wrote, or something a corrupted file left behind.
 */

export interface AppSettings {
  /** The phone taps back on presses. */
  haptics: boolean;
  /** Progress news reaches the feed: booked, received, washing, drying. */
  orderUpdates: boolean;
  /** Completed and cancelled orders stay in the feed as receipts. */
  finishedOrders: boolean;
}

export type SettingKey = keyof AppSettings;

/**
 * Everything on. A first launch should show the app doing all of what it
 * does; silence is a choice a person makes, not a state they are given.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  haptics: true,
  orderUpdates: true,
  finishedOrders: true,
};

export interface SettingRow {
  key: SettingKey;
  label: string;
  /** What the toggle actually changes, in the words of the thing it changes. */
  caption: string;
  /** Ionicons glyph. */
  icon: string;
}

export interface SettingSection {
  title: string;
  rows: readonly SettingRow[];
}

/**
 * Grouped by what the toggle is about rather than by where it is implemented:
 * how the phone feels is not the same subject as what reaches the feed, and a
 * single undivided list of three switches makes them look like one subject.
 */
export const SETTING_SECTIONS: readonly SettingSection[] = [
  {
    title: 'FEEL',
    rows: [
      {
        key: 'haptics',
        label: 'Haptic touch',
        caption: 'A small tap when you press something.',
        icon: 'phone-portrait-outline',
      },
    ],
  },
  {
    title: 'NOTIFICATIONS',
    rows: [
      {
        key: 'orderUpdates',
        label: 'Order updates',
        caption: 'Washing, drying, folded — where your laundry is.',
        icon: 'water-outline',
      },
      {
        key: 'finishedOrders',
        label: 'Finished orders',
        caption: 'Keeps completed and cancelled orders in your feed.',
        icon: 'checkmark-done-outline',
      },
    ],
  },
];

/** Every row across every section, in the order they are shown. */
export function settingRows(): readonly SettingRow[] {
  return SETTING_SECTIONS.flatMap((section) => section.rows);
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

/**
 * Reads whatever storage held. Anything that is not a boolean under a key
 * this version knows about is replaced by the default rather than trusted, so
 * a half-written file degrades to a working app instead of an undefined
 * toggle.
 */
export function parseSettings(raw: string | null): AppSettings {
  if (raw === null) return { ...DEFAULT_SETTINGS };

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }

  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return { ...DEFAULT_SETTINGS };
  }

  const source = stored as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key] as boolean;
  }
  return settings;
}

/** Flips one toggle and leaves the settings it was given alone. */
export function toggleSetting(settings: AppSettings, key: SettingKey): AppSettings {
  return { ...settings, [key]: !settings[key] };
}

export function isSettingOn(settings: AppSettings, key: SettingKey): boolean {
  return settings[key];
}

/**
 * A switch shows its state in its position, which a screen reader cannot see,
 * so the state goes into the label as well.
 */
export function toggleStateLabel(label: string, isOn: boolean): string {
  return `${label}, ${isOn ? 'on' : 'off'}`;
}
