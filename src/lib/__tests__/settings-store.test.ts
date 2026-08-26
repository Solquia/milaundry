import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS } from '../domain/app-settings';
import { loadSettings, saveSettings } from '../settings-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const KEY = 'milaundry.settings.v1';

beforeEach(() => {
  jest.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
});

describe('loadSettings', () => {
  it('is the defaults on a phone that has never opened settings', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(storage.getItem).toHaveBeenCalledWith(KEY);
  });

  it('returns what the customer chose last time', async () => {
    storage.getItem.mockResolvedValue(
      JSON.stringify({ haptics: false, orderUpdates: false, finishedOrders: true })
    );

    await expect(loadSettings()).resolves.toEqual({
      haptics: false,
      orderUpdates: false,
      finishedOrders: true,
    });
  });

  it('is the defaults rather than broken when the device refuses the read', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('persists the choice under its own key', async () => {
    const settings = { ...DEFAULT_SETTINGS, haptics: false };

    await expect(saveSettings(settings)).resolves.toEqual(settings);
    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(settings));
  });

  it('leaves the other stores alone', async () => {
    await saveSettings(DEFAULT_SETTINGS);

    const keysWritten = storage.setItem.mock.calls.map(([key]) => key);
    expect(keysWritten).toEqual([KEY]);
  });

  it('still honours the choice for this session when the write fails', async () => {
    // A silenced phone must stay silent now, even if the preference cannot
    // outlive the app.
    storage.setItem.mockRejectedValue(new Error('disk full'));
    const settings = { ...DEFAULT_SETTINGS, haptics: false };

    await expect(saveSettings(settings)).resolves.toEqual(settings);
  });
});
