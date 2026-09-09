/**
 * Where the shop is, on the shopfront.
 *
 * The address used to be one line under the name that a customer had to
 * retype into a maps app. With a pin the shopfront can show the corner itself
 * and open directions in one tap. Without a pin, on a build with no map key,
 * or on a build with no maps module at all, the card keeps the address and
 * the link out, so nobody gets less than they had.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Subtle, colors, elevation, space, type } from '@/components/ui-kit';
import {
  SHOP_MAP_ZOOM,
  directionsUrl,
  mapMode,
  searchUrl,
  type ShopPin,
} from '@/lib/domain/shop-location';
import { androidMapsKey } from '@/lib/maps-config';
import { loadNativeMaps } from '@/lib/maps-native';

interface ShopMapCardProps {
  name: string;
  address: string;
  pin: ShopPin | null;
}

const MAP_HEIGHT = 200;

export function ShopMapCard({ name, address, pin }: ShopMapCardProps) {
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

  return (
    <View style={styles.card}>
      {mode === 'map' && pin && maps ? (
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
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.pinIcon}>
            <Ionicons name="location" size={18} color={colors.actionInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {address ? <Subtle>{address}</Subtle> : null}
          </View>
        </View>
        <Button
          title={pin ? 'Open in Google Maps' : 'Find in Google Maps'}
          variant="outline"
          onPress={openMaps}
        />
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
  body: { padding: space.room, gap: space.cosy },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  name: { ...type.section, fontSize: 16, color: colors.text },
});