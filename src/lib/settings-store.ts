/**
 * Device-local storage for the preferences in `domain/app-settings`.
 *
 * Plain AsyncStorage under its own key, next to `saved-accounts-store`: three
 * booleans about how this phone behaves are not account data, so they neither
 * belong in the keychain nor on the server. They also should not follow the
 * customer onto a different handset — a silenced phone is a fact about that
 * phone.
 *
 * Neither call rejects. A preferences read that throws must not stop the app
 * from starting, and a write that throws must not stop the toggle from taking
 * effect for this session.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  parseSettings,
  type AppSettings,
} from './domain/app-settings';

const STORAGE_KEY = 'milaundry.settings.v1';

export async function loadSettings(): Promise<AppSettings> {
  try {
    return parseSettings(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists the choice and hands it back, stored or not. */
export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The switch has already moved on screen and the app is already obeying
    // it. Losing it at next launch is a smaller failure than refusing it now.
  }
  return settings;
}
