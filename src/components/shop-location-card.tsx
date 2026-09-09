/**
 * Where the shop tells customers it is.
 *
 * The address line has always been free text a customer had to retype into a
 * maps app. A pin is what a maps app can open. The merchant places it by
 * tapping the map, or by standing in the shop and pressing one button, and
 * can take it away again if it is wrong: a laundry on the wrong corner sends
 * customers to a stranger's door.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationPicker } from '@/components/location-picker';
import { Button, Card, ErrorText, Subtle, colors, space, type } from '@/components/ui-kit';
import { setShopLocation } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { pinLabel, roundPin, shopPin, type ShopPin } from '@/lib/domain/shop-location';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';

interface ShopLocationCardProps {
  shop: Shop;
}

export function ShopLocationCard({ shop }: ShopLocationCardProps) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState<ShopPin | null>(() => shopPin(shop));
  const [focusKey, setFocusKey] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const savedPin = shopPin(shop);
  const isDirty =
    (pin?.latitude ?? null) !== (savedPin?.latitude ?? null) ||
    (pin?.longitude ?? null) !== (savedPin?.longitude ?? null);

  const choose = (next: ShopPin | null) => {
    setSaved('');
    setError('');
    setIsDenied(false);
    setPin(next);
  };

  const locateMe = async () => {
    setIsLocating(true);
    setSaved('');
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setIsDenied(true);
        setError(friendlyMerchantError('locate-me', ''));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      choose(roundPin(position.coords));
      setFocusKey((key) => key + 1);
    } catch {
      setError(friendlyMerchantError('locate-me', ''));
    } finally {
      setIsLocating(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => setShopLocation(shop.id, pin),
    onSuccess: async (updated) => {
      await invalidateShopSurfaces(queryClient, shop.id, updated);
      setSaved(
        pin
          ? 'Saved. Customers can now get directions to you.'
          : 'Pin removed. Customers will see your address only.'
      );
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-location', err.message)),
  });

  return (
    <Card>
      <Text style={styles.heading}>Your location</Text>
      <Subtle>Tap the map where your shop is, so customers can get directions.</Subtle>

      <LocationPicker pin={pin} onChange={choose} focusKey={focusKey} />

      <Text style={styles.readout} accessibilityLiveRegion="polite">
        {pin ? `Pin at ${pinLabel(pin)}` : 'No pin yet. Tap the map where your shop is.'}
      </Text>

      <View style={styles.actions}>
        <Button
          title={isLocating ? 'Finding you…' : 'Use my current location'}
          variant="outline"
          disabled={isLocating}
          onPress={locateMe}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => choose(null)}
          disabled={pin === null}
        >
          <Text style={[styles.clearLink, pin === null && styles.clearLinkOff]}>Remove pin</Text>
        </Pressable>
      </View>

      <ErrorText>{error}</ErrorText>
      {isDenied ? (
        <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsLink}>Open Settings</Text>
        </Pressable>
      ) : null}
      {saved ? (
        <Text style={styles.saved} accessibilityLiveRegion="polite">
          {saved}
        </Text>
      ) : null}
      <Button
        title={mutation.isPending ? 'Saving…' : 'Save location'}
        disabled={!isDirty || mutation.isPending}
        onPress={() => {
          setError('');
          mutation.mutate();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.section, color: colors.text },
  readout: { ...type.caption, color: colors.subtle, marginTop: space.tight },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.cosy,
    marginTop: space.tight,
  },
  clearLink: { ...type.label, color: colors.actionInk },
  clearLinkOff: { color: colors.subtle },
  settingsLink: { ...type.label, color: colors.actionInk, marginTop: space.tight },
  saved: { ...type.body, color: colors.actionInk },
});
