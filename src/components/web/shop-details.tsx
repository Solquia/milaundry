/**
 * Where the shop is, how to reach it, and the code that connects to it.
 *
 * The app draws a map here. A web page has no map component that runs
 * everywhere, and the customer's own maps app is better at directions than an
 * embedded one anyway, so the address is a link that opens it. The QR is the
 * same counter code the shop prints: a customer who already has the app scans
 * it from the screen and is connected.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, space, type } from '@/components/ui-kit';
import { buildShopQr } from '@/lib/domain/qr';
import { directionsUrl, searchUrl, shopPin } from '@/lib/domain/shop-location';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontShop } from '@/lib/types';

interface ShopDetailsProps {
  shop: StorefrontShop;
  theme: StorefrontTheme;
}

/** The link that opens the customer's maps app on this shop, or null with no address. */
export function mapsLink(shop: StorefrontShop): string | null {
  const pin = shopPin(shop);
  if (pin) return directionsUrl(pin);
  return shop.address.trim() ? searchUrl(shop.address) : null;
}

export function ShopDetails({ shop, theme }: ShopDetailsProps) {
  const maps = mapsLink(shop);
  const phone = shop.phone.trim();

  return (
    <View style={styles.stack}>
      {shop.address.trim() || phone ? (
        <View style={styles.card}>
          {shop.address.trim() ? (
            <DetailRow
              icon="location-outline"
              title={shop.address}
              action={maps ? 'Directions' : null}
              onPress={maps ? () => Linking.openURL(maps) : undefined}
              theme={theme}
            />
          ) : null}
          {phone ? (
            <DetailRow
              icon="call-outline"
              title={phone}
              action="Call"
              onPress={() => Linking.openURL(`tel:${phone}`)}
              theme={theme}
            />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, styles.qrCard]}>
        <View style={styles.qrFrame}>
          <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={168} />
        </View>
        <View style={styles.qrWords}>
          <Text style={styles.qrTitle}>Have the MiLaundry app?</Text>
          <Text style={styles.qrBody}>
            Scan this code in the app to connect to {shop.name} and follow every load
            from your phone.
          </Text>
        </View>
      </View>
    </View>
  );
}

interface DetailRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  action: string | null;
  onPress?: () => void;
  theme: StorefrontTheme;
}

function DetailRow({ icon, title, action, onPress, theme }: DetailRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.mark, { backgroundColor: theme.brandSoft }]}>
        <Ionicons name={icon} size={18} color={theme.brandInk} />
      </View>
      <Text style={styles.rowTitle}>{title}</Text>
      {action ? <Text style={[styles.rowAction, { color: theme.brandInk }]}>{action}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.room },
  pressed: { opacity: 0.6 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...type.body, color: colors.text, flex: 1 },
  rowAction: { ...type.label },
  qrCard: { padding: space.section, alignItems: 'center', gap: space.room },
  qrFrame: { padding: space.cosy, backgroundColor: '#FFFFFF', borderRadius: 12 },
  qrWords: { gap: space.tight, alignItems: 'center' },
  qrTitle: { ...type.section, color: colors.text, textAlign: 'center' },
  qrBody: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
