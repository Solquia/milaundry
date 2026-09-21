/**
 * Where the shop is, on the shopfront.
 *
 * The address used to be one line under the name that a customer had to
 * retype into a maps app. Now the card shows the corner itself and opens
 * directions in one tap.
 *
 * Three ways of drawing that corner, in the order they are preferred:
 * the phone's own map when this build shipped `expo-maps` and has a key for
 * it; Carto tiles through `components/shop-map` when it did not,
 * which is what an Expo Go or pre-`expo-maps` build now gets instead of a
 * blank card; and the address alone for a shop that has never placed a pin.
 * Nobody gets less than they had, and most builds get a great deal more.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { ShopMap } from '@/components/shop-map';
import { ErrorText, Subtle, colors, elevation, space, type } from '@/components/ui-kit';
import {
  SHOP_MAP_ZOOM,
  directionsUrl,
  mapMode,
  searchUrl,
  type ShopPin,
} from '@/lib/domain/shop-location';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { androidMapsKey } from '@/lib/maps-config';
import { loadNativeMaps } from '@/lib/maps-native';

interface ShopMapCardProps {
  name: string;
  address: string;
  pin: ShopPin | null;
  /** The shop's own colour, so the corner matches the rest of its shopfront. */
  theme: StorefrontTheme;
}

const MAP_HEIGHT = 216;

export function ShopMapCard({ name, address, pin, theme }: ShopMapCardProps) {
  const [error, setError] = useState('');
  const maps = loadNativeMaps();
  const mode = mapMode({
    pin,
    address,
    platform: Platform.OS,
    androidMapsKey: androidMapsKey(),
    hasNativeMaps: maps !== null,
  });

  if (mode === 'hidden') return null;

  const openMaps = async () => {
    setError('');
    try {
      await Linking.openURL(pin ? directionsUrl(pin) : searchUrl(address));
    } catch {
      setError('Could not open Maps on this phone.');
    }
  };

  const cameraPosition = pin ? { coordinates: pin, zoom: SHOP_MAP_ZOOM } : undefined;
  const showsLiveMap = mode === 'map' && pin !== null && maps !== null;

  return (
    <View style={styles.card}>
      {showsLiveMap ? (
        <View style={styles.map} accessibilityLabel={`Map showing ${name}`}>
          {Platform.OS === 'ios' ? (
            <maps.AppleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={cameraPosition}
              markers={[{ coordinates: pin, title: name }]}
              onMarkerClick={openMaps}
            />
          ) : (
            <maps.GoogleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={cameraPosition}
              markers={[{ coordinates: pin, title: name, snippet: address }]}
              uiSettings={{
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                mapToolbarEnabled: false,
                compassEnabled: false,
              }}
              onMarkerClick={openMaps}
            />
          )}
          {/* Just enough shade at the top for the shop's tag to read over a
              pale street, and none in the middle, where the map is the point. */}
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="shopMapScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#04203F" stopOpacity="0.3" />
                <Stop offset="0.4" stopColor="#04203F" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#shopMapScrim)" />
          </Svg>
          <View pointerEvents="none" style={[styles.tag, { backgroundColor: theme.brand }]}>
            <Ionicons name="location" size={13} color={theme.onBrand} />
            <Text style={[styles.tagText, { color: theme.onBrand }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
      ) : null}

      {/* No native map available, but a pin to draw: tiles do the job. */}
      {!showsLiveMap && pin ? (
        <ShopMap
          pin={pin}
          theme={theme}
          height={MAP_HEIGHT}
          label={`Map showing where ${name} is`}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.pinIcon, { backgroundColor: theme.brandSoft }]}>
            <Ionicons name="location" size={18} color={theme.brandInk} />
          </View>
          <View style={styles.words}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {address ? <Subtle>{address}</Subtle> : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openMaps}
          style={({ pressed }) => [
            styles.go,
            { backgroundColor: theme.brand },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="navigate" size={16} color={theme.onBrand} />
          <Text style={[styles.goTitle, { color: theme.onBrand }]}>
            {pin ? 'Get directions' : 'Find in Google Maps'}
          </Text>
        </Pressable>
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.rest,
  },
  map: { height: MAP_HEIGHT, backgroundColor: colors.sunken },
  /** The shop's name, said on the map itself, so the pin is never anonymous. */
  tag: {
    position: 'absolute',
    top: space.cosy,
    left: space.cosy,
    maxWidth: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.cosy,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { ...type.label, fontSize: 12, flexShrink: 1 },
  body: { padding: space.room, gap: space.cosy },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  words: { flex: 1 },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.section, fontSize: 16, color: colors.text },
  go: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
  },
  goTitle: { ...type.label, fontSize: 16 },
  pressed: { opacity: 0.85 },
});
