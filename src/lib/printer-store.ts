/**
 * Device-local memory of which receipt printer this phone pairs with.
 *
 * A printer belongs to a counter, not to an account: the same shop login on a
 * rider's phone should not try to reach the printer under the shop's desk.
 * So it lives in AsyncStorage next to `settings-store`, and like that store
 * neither call rejects. A phone that cannot read its printer record simply
 * has no printer until the merchant pairs one again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSavedPrinter, type SavedPrinter } from './domain/printer';

const STORAGE_KEY = 'milaundry.printer.v1';

export async function loadSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    return parseSavedPrinter(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveSavedPrinter(printer: SavedPrinter): Promise<SavedPrinter> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
  } catch {
    // The pairing already happened; forgetting it at next launch is the
    // smaller failure. The card will offer to pair again.
  }
  return printer;
}

export async function forgetSavedPrinter(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the next load either finds it or does not.
  }
}
