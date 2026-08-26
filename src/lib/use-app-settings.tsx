/**
 * The customer's preferences, live, for the whole app.
 *
 * A context rather than a read at each call site because a haptic has to
 * answer the finger that is still on the glass: the phone cannot go and ask
 * storage first. Settings load once at launch, and the app runs on the
 * defaults for the moment before they arrive — which is the same thing a
 * first launch does, so nothing special happens on a slow disk.
 *
 * Toggling is optimistic. The switch moves, the app obeys, and the write
 * happens behind it; `settings-store` cannot reject, so there is no failed
 * write to roll back to.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_SETTINGS,
  toggleSetting,
  type AppSettings,
  type SettingKey,
} from './domain/app-settings';
import { hapticEffectFor, type HapticIntent } from './domain/haptic-feedback';
import { performHaptic } from './haptics';
import { loadSettings, saveSettings } from './settings-store';

interface AppSettingsValue {
  settings: AppSettings;
  /** False until the stored preferences have been read from the device. */
  isLoaded: boolean;
  toggle: (key: SettingKey) => void;
}

const AppSettingsContext = createContext<AppSettingsValue>({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  toggle: () => {},
});

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void loadSettings().then((stored) => {
      if (!isMounted) return;
      setSettings(stored);
      setIsLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggle = useCallback((key: SettingKey) => {
    setSettings((current) => {
      const next = toggleSetting(current, key);
      void saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, isLoaded, toggle }),
    [settings, isLoaded, toggle]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsValue {
  return useContext(AppSettingsContext);
}

/**
 * The tap a press gives back. Named for what the press *means* rather than
 * for a weight, so the screens never have to know which effect that is or
 * whether the customer wants it at all.
 */
export function useHaptic(): (intent: HapticIntent) => void {
  const { settings } = useAppSettings();

  return useCallback(
    (intent: HapticIntent) => performHaptic(hapticEffectFor(intent, settings.haptics)),
    [settings.haptics]
  );
}
