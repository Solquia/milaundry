/**
 * Device-local list of orders the customer cleared off home, kept per account
 * so two people sharing a phone do not tidy each other's history. Same pattern
 * as `settings-store` and `doorbell-store` — neither call rejects.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseHiddenOrderIds } from './domain/hidden-orders';

const KEY_PREFIX = 'milaundry.hidden-orders.v1.';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function loadHiddenOrderIds(userId: string): Promise<string[]> {
  try {
    return parseHiddenOrderIds(await AsyncStorage.getItem(keyFor(userId)));
  } catch {
    return [];
  }
}

export async function saveHiddenOrderIds(userId: string, ids: string[]): Promise<string[]> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(ids));
  } catch {
    // The rows already left the screen. Seeing them again next launch is
    // smaller than refusing the tap.
  }
  return ids;
}
