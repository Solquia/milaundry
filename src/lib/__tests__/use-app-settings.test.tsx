import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { DEFAULT_SETTINGS, type AppSettings } from '../domain/app-settings';
import { performHaptic } from '../haptics';
import { loadSettings, saveSettings } from '../settings-store';
import { AppSettingsProvider, useAppSettings, useHaptic } from '../use-app-settings';

jest.mock('../settings-store', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn((settings: unknown) => Promise.resolve(settings)),
}));
jest.mock('../haptics', () => ({ performHaptic: jest.fn() }));

const load = loadSettings as jest.MockedFunction<typeof loadSettings>;
const save = saveSettings as jest.MockedFunction<typeof saveSettings>;
const perform = performHaptic as jest.MockedFunction<typeof performHaptic>;

/** The provider's value plus a haptic trigger, as a screen would see them. */
type Probe = ReturnType<typeof useAppSettings> & {
  haptic: ReturnType<typeof useHaptic>;
};

/**
 * Mounts the provider and hands back the live hook values. Everything is read
 * through the same context a screen uses, so nothing here reaches inside.
 */
async function mount(): Promise<{ current: Probe }> {
  const seen = { current: undefined as unknown as Probe };

  function Consumer() {
    const settings = useAppSettings();
    const haptic = useHaptic();
    seen.current = { ...settings, haptic };
    return null;
  }

  await act(async () => {
    TestRenderer.create(
      <AppSettingsProvider>
        <Consumer />
      </AppSettingsProvider>
    );
  });

  return seen;
}

beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue({ ...DEFAULT_SETTINGS });
  save.mockImplementation((settings: AppSettings) => Promise.resolve(settings));
});

describe('AppSettingsProvider', () => {
  it('runs on the stored preferences once the device has been read', async () => {
    load.mockResolvedValue({
      haptics: false,
      orderUpdates: false,
      finishedOrders: true,
    });

    const probe = await mount();

    expect(probe.current.settings.haptics).toBe(false);
    expect(probe.current.isLoaded).toBe(true);
  });

  it('reads the device once, not once per screen that asks', async () => {
    await mount();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('flips a toggle and writes it behind the switch', async () => {
    const probe = await mount();

    await act(async () => {
      probe.current.toggle('orderUpdates');
    });

    expect(probe.current.settings.orderUpdates).toBe(false);
    expect(save).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, orderUpdates: false });
  });

  it('leaves the other settings where they were', async () => {
    const probe = await mount();

    await act(async () => {
      probe.current.toggle('haptics');
    });

    expect(probe.current.settings.orderUpdates).toBe(true);
    expect(probe.current.settings.finishedOrders).toBe(true);
  });
});

describe('useHaptic', () => {
  it('performs the effect the intent maps to', async () => {
    const probe = await mount();

    act(() => probe.current.haptic('tap'));

    expect(perform).toHaveBeenCalledWith({ kind: 'impact', style: 'Light' });
  });

  it('performs nothing once the customer has turned haptics off', async () => {
    load.mockResolvedValue({ ...DEFAULT_SETTINGS, haptics: false });
    const probe = await mount();

    act(() => probe.current.haptic('commit'));

    expect(perform).toHaveBeenCalledWith(null);
  });

  it('goes quiet the moment the switch is flipped, not at next launch', async () => {
    const probe = await mount();

    await act(async () => {
      probe.current.toggle('haptics');
    });
    act(() => probe.current.haptic('tap'));

    expect(perform).toHaveBeenLastCalledWith(null);
  });
});
