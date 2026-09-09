/**
 * Where the map learns which build it is in.
 *
 * Google Maps on Android needs a key baked into the native build; without one
 * the map renders as a blank grey grid. The key lives in app.json, so at
 * runtime the app can read it back and decide whether to embed a map at all.
 */
import Constants from 'expo-constants';

/** The Android Google Maps key this build shipped with, or null if unset. */
export function androidMapsKey(): string | null {
  return Constants.expoConfig?.android?.config?.googleMaps?.apiKey ?? null;
}