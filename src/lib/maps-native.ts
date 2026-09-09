/**
 * Where the app finds out whether it can draw a map at all.
 *
 * `expo-maps` calls `requireNativeModule('ExpoMaps')` the moment it is
 * imported, so a static import crashes every screen that reaches it on a
 * binary built without the module: Expo Go, or a dev client from before the
 * dependency was added. Loading it here, once, behind a try/catch turns that
 * red screen into "no map on this build" and lets the address card carry on.
 *
 * To get the map back, rebuild the native app (`npx expo run:android` /
 * `npx expo run:ios`, or an EAS build) so ExpoMaps is compiled in.
 */
import type { AppleMaps, GoogleMaps } from 'expo-maps';

export interface NativeMaps {
  AppleMaps: typeof AppleMaps;
  GoogleMaps: typeof GoogleMaps;
}

let cached: NativeMaps | null | undefined;

/** The expo-maps module, or null when this build has no ExpoMaps native module. */
export function loadNativeMaps(): NativeMaps | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-maps') as NativeMaps;
    cached = mod.AppleMaps && mod.GoogleMaps ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether the running binary shipped the ExpoMaps native module. */
export function hasNativeMaps(): boolean {
  return loadNativeMaps() !== null;
}
