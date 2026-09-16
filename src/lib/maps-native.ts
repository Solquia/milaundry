/**
 * Where the app finds out whether it can draw a map at all.
 *
 * `expo-maps` calls `requireNativeModule('ExpoMaps')` the moment it is
 * imported, so a static import crashes every screen that reaches it on a
 * binary built without the module: Expo Go, or a dev client from before the
 * dependency was added.
 *
 * So ask first, and only then load. `requireOptionalNativeModule` is the same
 * lookup `requireNativeModule` performs, except that it answers `null` for a
 * module the binary does not have instead of throwing — which means that on a
 * build without ExpoMaps this file never evaluates `expo-maps` at all, and
 * there is no thrown error to catch, log, or surface. Catching the throw kept
 * the screen alive, but it still announced itself as an app error on every
 * render of a shop page, which is not what a missing optional feature should
 * look like.
 *
 * The try/catch stays as the second line: the map *views* are registered
 * separately from the module (`ExpoGoogleMaps`, `ExpoAppleMaps`), and a binary
 * missing those would still throw from inside the package's own top level.
 *
 * To get the map back, rebuild the native app (`npx expo run:android` /
 * `npx expo run:ios`, or an EAS build) so ExpoMaps is compiled in.
 */
import { requireOptionalNativeModule } from 'expo';
import type { AppleMaps, GoogleMaps } from 'expo-maps';

export interface NativeMaps {
  AppleMaps: typeof AppleMaps;
  GoogleMaps: typeof GoogleMaps;
}

let cached: NativeMaps | null | undefined;

/** The expo-maps module, or null when this build has no ExpoMaps native module. */
export function loadNativeMaps(): NativeMaps | null {
  if (cached !== undefined) return cached;
  // The question the package asks on import, asked somewhere it can be
  // answered "no" without throwing.
  if (requireOptionalNativeModule('ExpoMaps') === null) {
    cached = null;
    return cached;
  }
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
