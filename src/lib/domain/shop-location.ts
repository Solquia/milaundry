/**
 * Where a laundry is, as a pin.
 *
 * The shop's `address` has always been a free-text line ("12 Mabini St") that
 * a customer had to retype into a maps app. A pin is the thing a maps app can
 * actually open, so this module owns the pin's rules: what counts as one, how
 * it is stored, the link that opens directions to it, and when the shopfront
 * can embed a map at all (Android needs a Google Maps key; the web gets none).
 */

export interface ShopPin {
  latitude: number;
  longitude: number;
}

/** The subset of a shop row this module reads. */
export interface LocatedShop {
  latitude?: number | null;
  longitude?: number | null;
}

/** Street level: the storefront and the corner it sits on. */
export const SHOP_MAP_ZOOM = 16;
/** City level: where the picker opens for a shop with no pin yet. */
export const PICKER_FALLBACK_ZOOM = 11;
/** Metro Manila, since that is where every shop on the platform is so far. */
export const PICKER_FALLBACK_CENTER: ShopPin = { latitude: 14.5995, longitude: 120.9842 };

/** Six decimals is about eleven centimetres; more is noise from the GPS. */
const PIN_DECIMALS = 6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Whether a value is a pin somewhere on Earth. Null island (0, 0) is refused:
 * it is what an unset field or a failed lookup produces, never a laundry.
 */
export function isValidPin(value: unknown): value is ShopPin {
  if (typeof value !== 'object' || value === null) return false;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return !(latitude === 0 && longitude === 0);
}

/** The pin a shop saved, or null until it places one. Half a pin is no pin. */
export function shopPin(shop: LocatedShop): ShopPin | null {
  const candidate = { latitude: shop.latitude, longitude: shop.longitude };
  return isValidPin(candidate) ? candidate : null;
}

/** The precision we store, so a re-saved pin compares equal to itself. */
export function roundPin(pin: ShopPin): ShopPin {
  const factor = 10 ** PIN_DECIMALS;
  return {
    latitude: Math.round(pin.latitude * factor) / factor,
    longitude: Math.round(pin.longitude * factor) / factor,
  };
}

/** Google Maps directions to the pin; opens the app when installed. */
export function directionsUrl(pin: ShopPin): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.latitude},${pin.longitude}`;
}

/** A Google Maps search for the address, for shops that have not placed a pin. */
export function searchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export type MapMode = 'map' | 'address-only' | 'hidden';

/** A key that is empty or still the config placeholder ("<...>") is no key. */
function hasUsableKey(key: string | null | undefined): boolean {
  const trimmed = key?.trim() ?? '';
  return trimmed.length > 0 && !trimmed.startsWith('<');
}

/**
 * What the shopfront can show for "where is this shop":
 * - `map`: an embedded native map with the pin (iOS always; Android with a key)
 * - `address-only`: the address and a link out to Google Maps
 * - `hidden`: nothing, because the shop has given us nothing to show
 *
 * `hasNativeMaps` is whether the running binary shipped the ExpoMaps native
 * module at all. Expo Go and a dev client built before expo-maps was added
 * have not, and importing the package there throws, so the caller probes it
 * and the map degrades to the address instead of taking the screen down.
 */
export function mapMode(input: {
  pin: ShopPin | null;
  address: string;
  platform: string;
  androidMapsKey: string | null | undefined;
  hasNativeMaps?: boolean;
}): MapMode {
  const hasAddress = input.address.trim().length > 0;
  if (!input.pin) return hasAddress ? 'address-only' : 'hidden';
  if (input.hasNativeMaps === false) return 'address-only';
  if (input.platform === 'ios') return 'map';
  if (input.platform === 'android' && hasUsableKey(input.androidMapsKey)) return 'map';
  return 'address-only';
}

/** The pin read back to the merchant under the picker. */
export function pinLabel(pin: ShopPin): string {
  return `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`;
}
