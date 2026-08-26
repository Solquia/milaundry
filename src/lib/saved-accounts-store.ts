/**
 * Device-local storage for the sign-in shortcuts in `domain/saved-accounts`.
 *
 * Plain AsyncStorage, deliberately: the stored value is a list of login
 * identifiers a person already typed into a visible field, with no password
 * and no session token, so it needs no keychain. `supabase.ts` keeps the real
 * session under its own key.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  forgetAccount,
  parseSavedAccounts,
  rememberAccount,
  type SavedAccount,
} from './domain/saved-accounts';

const STORAGE_KEY = 'milaundry.saved-accounts.v1';

async function write(accounts: SavedAccount[]): Promise<SavedAccount[]> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // A convenience list is not worth failing a sign-in over: the caller still
    // gets the updated list for this session, it just will not outlive the app.
  }
  return accounts;
}

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  try {
    return parseSavedAccounts(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Records a login that just worked. Returns the list to show next time. */
export async function rememberSignIn(loginInput: string): Promise<SavedAccount[]> {
  const accounts = rememberAccount(await loadSavedAccounts(), loginInput);
  return write(accounts);
}

export async function forgetSavedAccount(id: string): Promise<SavedAccount[]> {
  const accounts = forgetAccount(await loadSavedAccounts(), id);
  return write(accounts);
}
