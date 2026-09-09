/**
 * A map the merchant taps to say where their shop is.
 *
 * Tap-to-place rather than drag: a drag on a phone fights the scroll view the
 * card sits in, and a tap is the gesture people already use to "put a pin
 * here". The camera follows the pin only when the parent asks (after "Use my
 * current location"), never on the merchant's own taps, so a careful second
 * tap lands where they aimed rather than on a map that just moved under them.
 *
 * Android needs a Google Maps key baked into the build. Without one the map
 * would render as a blank grey grid, so the picker says what is missing. A
 * build with no ExpoMaps native module at all (Expo Go, or a dev client from
 * before expo-maps was added) gets the same placeholder with a rebuild hint.
 */
import type { AppleMaps, GoogleMaps } from 'expo-maps';
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Subtle, colors, space, type } from '@/components/ui-kit';
import { androidMapsKey } from '@/lib/maps-config';
import { loadNativeMaps } from '@/lib/maps-native';
import {
  PICKER_FALLBACK_CENTER,
  PICKER_FALLBACK_ZOOM,
  SHOP_MAP_ZOOM,
  isValidPin,
  mapMode,
  roundPin,
  type ShopPin,
} from '@/lib/domain/shop-location';

interface LocationPickerProps {
  pin: ShopPin | null;
  onChange: (pin: ShopPin) => void;
  /** Bump to move the camera onto the pin; taps alone leave the camera be. */
  focusKey?: number;
  height?: number;
}

export function LocationPicker({ pin, onChange, focusKey = 0, height = 240 }: LocationPickerProps) {
  const googleRef = useRef<GoogleMaps.MapView>(null);
  const appleRef = useRef<AppleMaps.MapView>(null);
  const maps = loadNativeMaps();

  // A pin or a city: the picker always opens on *somewhere* real.
  const canEmbed =
    mapMode({
      pin: pin ?? PICKER_FALLBACK_CENTER,
      address: '',
      platform: Platform.OS,
      androidMapsKey: androidMapsKey(),
      hasNativeMaps: maps !== null,
    }) === 'map';

  const cameraPosition = pin
    ? { coordinates: pin, zoom: SHOP_MAP_ZOOM }
    : { coordinates: PICKER_FALLBACK_CENTER, zoom: PICKER_FALLBACK_ZOOM };

  // Follow the pin only when told to. `focusKey` is the whole dependency on
  // purpose: reacting to `pin` would recentre under every tap.
  useEffect(() => {
    if (focusKey === 0 || !pin) return;
    const target = { coordinates: pin, zoom: SHOP_MAP_ZOOM };
    googleRef.current?.setCameraPosition(target);
    appleRef.current?.setCameraPosition(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const place = (event: { coordinates: { latitude?: number; longitude?: number } }) => {
    if (isValidPin(event.coordinates)) onChange(roundPin(event.coordinates));
  };

  if (!canEmbed || !maps) {
    return (
      <View style={[styles.frame, styles.placeholder, { height }]}>
        <Text style={styles.placeholderTitle}>Map not available in this build</Text>
        <Subtle>{placeholderHint(maps !== null)}</Subtle>
      </View>
    );
  }

  const { AppleMaps: Apple, GoogleMaps: Google } = maps;

  const markers = pin ? [{ coordinates: pin, title: 'Your shop' }] : [];

  return (
    <View style={[styles.frame, { height }]}>
      {Platform.OS === 'ios' ? (
        <Apple.View
          ref={appleRef}
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          markers={markers}
          onMapClick={place}
        />
      ) : (
        <Google.View
          ref={googleRef}
          style={StyleSheet.absoluteFill}
          cameraPosition={cameraPosition}
          markers={markers}
          onMapClick={place}
          uiSettings={{
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            compassEnabled: false,
          }}
        />
      )}
    </View>
  );
}

/** Why there is no map, and what fixes it. "Use my current location" always works. */
function placeholderHint(hasNativeMaps: boolean): string {
  if (!hasNativeMaps) {
    return 'This build was made without the maps module. Rebuild the app (npx expo run:android) to place the pin by hand. "Use my current location" still works.';
  }
  return Platform.OS === 'android'
    ? 'Add the Google Maps key to app.json and rebuild to place the pin by hand. "Use my current location" still works.'
    : 'Open the app on a phone to place the pin.';
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    paddingHorizontal: space.section,
  },
  placeholderTitle: { ...type.label, color: colors.text, textAlign: 'center' },
});
