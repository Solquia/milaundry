import {
  DEFAULT_SETTINGS,
  SETTING_SECTIONS,
  isSettingOn,
  parseSettings,
  settingRows,
  toggleSetting,
  toggleStateLabel,
  type AppSettings,
} from '../app-settings';

describe('DEFAULT_SETTINGS', () => {
  it('starts a new phone with haptics and every notification on', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      haptics: true,
      orderUpdates: true,
      finishedOrders: true,
    });
  });
});

describe('parseSettings', () => {
  it('gives a device that has never opened settings the defaults', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to the defaults rather than throwing on unreadable storage', () => {
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps what was stored and defaults what a new version added', () => {
    // A phone that set its preferences before `finishedOrders` existed.
    expect(parseSettings(JSON.stringify({ haptics: false, orderUpdates: false }))).toEqual({
      haptics: false,
      orderUpdates: false,
      finishedOrders: true,
    });
  });

  it('ignores a stored value that is not a true or false', () => {
    expect(parseSettings(JSON.stringify({ haptics: 'yes' })).haptics).toBe(true);
  });

  it('drops keys that are not settings, so storage cannot widen the object', () => {
    const parsed = parseSettings(JSON.stringify({ haptics: false, isAdmin: true }));

    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, haptics: false });
    expect('isAdmin' in parsed).toBe(false);
  });

  it('is the defaults when storage held a list or a bare string', () => {
    expect(parseSettings(JSON.stringify(['haptics']))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify('haptics'))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify(null))).toEqual(DEFAULT_SETTINGS);
  });
});

describe('toggleSetting', () => {
  it('flips only the toggle that was tapped', () => {
    expect(toggleSetting(DEFAULT_SETTINGS, 'haptics')).toEqual({
      ...DEFAULT_SETTINGS,
      haptics: false,
    });
  });

  it('turns a setting back on', () => {
    const off: AppSettings = { ...DEFAULT_SETTINGS, orderUpdates: false };

    expect(toggleSetting(off, 'orderUpdates').orderUpdates).toBe(true);
  });

  it('leaves the settings it was given untouched', () => {
    const before: AppSettings = { ...DEFAULT_SETTINGS };

    toggleSetting(before, 'haptics');

    expect(before).toEqual(DEFAULT_SETTINGS);
  });
});

describe('isSettingOn', () => {
  it('reads a single toggle', () => {
    expect(isSettingOn(DEFAULT_SETTINGS, 'haptics')).toBe(true);
    expect(isSettingOn({ ...DEFAULT_SETTINGS, haptics: false }, 'haptics')).toBe(false);
  });
});

describe('SETTING_SECTIONS', () => {
  it('shows every setting exactly once, so none is unreachable or doubled', () => {
    const keys = settingRows().map((row) => row.key);

    expect([...keys].sort()).toEqual(['finishedOrders', 'haptics', 'orderUpdates']);
  });

  it('says what each toggle does in words, not just its name', () => {
    for (const row of settingRows()) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.caption.length).toBeGreaterThan(0);
      expect(row.icon.length).toBeGreaterThan(0);
      expect(row.caption).not.toBe(row.label);
    }
  });

  it('groups haptics apart from the notification toggles', () => {
    const sectionOf = (key: string) =>
      SETTING_SECTIONS.find((section) => section.rows.some((row) => row.key === key));

    expect(sectionOf('haptics')).not.toBe(sectionOf('orderUpdates'));
    expect(sectionOf('orderUpdates')).toBe(sectionOf('finishedOrders'));
  });

  it('titles every section', () => {
    for (const section of SETTING_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.rows.length).toBeGreaterThan(0);
    }
  });
});

describe('toggleStateLabel', () => {
  it('announces the state a screen reader cannot see on the switch', () => {
    expect(toggleStateLabel('Haptic touch', true)).toBe('Haptic touch, on');
    expect(toggleStateLabel('Haptic touch', false)).toBe('Haptic touch, off');
  });
});
