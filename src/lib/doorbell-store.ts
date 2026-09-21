/**
 * Device-local mute for the shop doorbell.
 *
 * The bell belongs to this phone, not to the shop account: a silenced
 * counter phone should not un-silence the owner's phone. Same pattern as
 * `settings-store` and `printer-store` — neither call rejects.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseDoorbellEnabled } from './domain/shop-doorbell';

const STORAGE_KEY = 'milaundry.doorbell.v1';

export async function loadDoorbellEnabled(): Promise<boolean> {
  try {
    return parseDoorbellEnabled(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return parseDoorbellEnabled(null);
  }
}

export async function saveDoorbellEnabled(enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // The switch already moved. Losing it at next launch is smaller than
    // refusing the tap.
  }
  return enabled;
}
