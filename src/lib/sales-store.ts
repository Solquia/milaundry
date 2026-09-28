/**
 * Device-local memory for the Sales screen: the owner's daily goal, the day
 * the goal was last celebrated, and the last drawer count.
 *
 * Kept on the device, like `settings-store`: a goal is a note the owner keeps
 * for themselves at this counter, and a drawer count is a record of this
 * till. None of it is shop data the server needs, and none of it may break
 * the screen, so nothing here rejects.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DrawerTone } from './domain/day-close';

const goalKey = (shopId: string) => `milaundry.sales.goal.${shopId}`;
const cheerKey = (shopId: string) => `milaundry.sales.celebrated.${shopId}`;
const closeKey = (shopId: string, day: string) => `milaundry.sales.close.${shopId}.${day}`;

export interface SavedClose {
  closedAt: string;
  counted: number;
  difference: number;
  tone: DrawerTone;
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // The screen already shows the new value; losing it at next launch is the lesser failure.
  }
}

export async function loadGoal(shopId: string): Promise<number | null> {
  const raw = Number(await read(goalKey(shopId)));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export const saveGoal = (shopId: string, goal: number | null): Promise<void> =>
  write(goalKey(shopId), goal === null ? null : String(goal));

export const loadCelebrated = (shopId: string): Promise<string | null> => read(cheerKey(shopId));

export const saveCelebrated = (shopId: string, day: string): Promise<void> => write(cheerKey(shopId), day);

export async function loadClose(shopId: string, day: string): Promise<SavedClose | null> {
  const raw = await read(closeKey(shopId, day));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedClose>;
    if (typeof parsed.closedAt !== 'string' || typeof parsed.difference !== 'number') return null;
    return parsed as SavedClose;
  } catch {
    return null;
  }
}

export const saveClose = (shopId: string, day: string, close: SavedClose): Promise<void> =>
  write(closeKey(shopId, day), JSON.stringify(close));
