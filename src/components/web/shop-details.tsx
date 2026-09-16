/**
 * Where the shop is, how to reach it, and the code that connects to it.
 *
 * This used to be one line of address text with a "Directions" link beside it,
 * because a web page has no map component that runs everywhere. It has one now:
 * `components/shop-map` draws the street from OpenStreetMap tiles, so a
 * customer weighing the walk can see the corner rather than read its name. The
 * link out is still here — the customer's own maps app is better at directions
 * than any embedded one — but it is now a button under a picture of the place
 * it leads to. A shop that has not placed a pin keeps exactly what it had.
 *
 * The QR is the same counter code the shop prints: a customer who already has
 * the app scans it from the screen and is connected.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ShopMap } from '@/components/shop-map';
import { LIFT_MARK, ScannerFrame } from '@/components/storefront-flourishes';
import { colors, elevation, space, type } from '@/components/ui-kit';
import { buildShopQr } from '@/lib/domain/qr';
import { directionsUrl, searchUrl, shopPin } from '@/lib/domain/shop-location';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontShop } from '@/lib/types';

interface ShopDetailsProps {
  shop: StorefrontShop;
  theme: StorefrontTheme;
}

/** Tall enough to read as a place, short enough to leave the QR on the screen. */
const MAP_HEIGHT = 188;
const QR_SIZE = 148;
/** The white margin a QR needs to resolve, and where the brackets sit. */
const QR_QUIET = 14;

/** The link that opens the customer's maps app on this shop, or null with no address. */
export function mapsLink(shop: StorefrontShop): string | null {
  const pin = shopPin(shop);
  if (pin) return directionsUrl(pin);
  return shop.address.trim() ? searchUrl(shop.address) : null;
}

export function ShopDetails({ shop, theme }: ShopDetailsProps) {
  const maps = mapsLink(shop);
  const phone = shop.phone.trim();
  const address = shop.address.trim();
  const pin = shopPin(shop);

  return (
    <View style={styles.stack}>
      {address || phone ? (
        <View style={styles.card} {...LIFT_MARK}>
          {pin ? (
            <ShopMap
              pin={pin}
              theme={theme}
              height={MAP_HEIGHT}
              label={`Map showing where ${shop.name} is`}
            />
          ) : null}

          <View style={[styles.place, { backgroundColor: theme.brandSoft }]}>
            {address ? (
              <View style={styles.placeRow}>
                <View style={styles.mark}>
                  <Ionicons name="location" size={18} color={theme.brandInk} />
                </View>
                <View style={styles.placeWords}>
                  <Text style={styles.placeTitle}>{address}</Text>
                  <Text style={styles.placeNote}>
                    {pin ? 'Tap for turn-by-turn directions' : 'Search this address in Maps'}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.reach}>
              {maps ? (
                <ReachButton
                  icon="navigate"
                  title="Directions"
                  onPress={() => Linking.openURL(maps)}
                  fill={theme.brand}
                  ink={theme.onBrand}
                />
              ) : null}
              {phone ? (
                <ReachButton
                  icon="call"
                  title={phone}
                  onPress={() => Linking.openURL(`tel:${phone}`)}
                  fill={colors.card}
                  ink={theme.brandInk}
                />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, styles.qrCard, { backgroundColor: theme.brandSoft }]} {...LIFT_MARK}>
        <View style={styles.qrHalo}>
          <View style={styles.qrFrame}>
            <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={QR_SIZE} />
          </View>
          {/* Outside the code's quiet zone, never over it: this square exists to
              be read by a camera, and anything drawn across it is a scan that
              fails. */}
          <ScannerFrame theme={theme} size={QR_SIZE + QR_QUIET * 2} />
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

interface ReachButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  onPress: () => void;
  fill: string;
  ink: string;
}

function ReachButton({ icon, title, onPress, fill, ink }: ReachButtonProps) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.reachButton, { backgroundColor: fill }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={ink} />
      <Text style={[styles.reachTitle, { color: ink }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.rest,
  },
  place: { padding: space.room, gap: space.cosy },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  placeWords: { flex: 1, gap: 2 },
  placeTitle: { ...type.body, fontWeight: '600', color: colors.text },
  placeNote: { ...type.caption, color: colors.subtle },
  /**
   * White on the coloured strip, not a paler tint of it. The strip took the
   * shop's colour as its ground, and a pale-on-pale badge on it disappeared —
   * the lift has to come from the other direction now.
   */
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  /** Two ways to reach the shop, equal width, wrapping before either is squeezed. */
  reach: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  reachButton: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
  },
  reachTitle: { ...type.label, flexShrink: 1 },
  pressed: { opacity: 0.8 },
  qrCard: { padding: space.section, alignItems: 'center', gap: space.room },
  /**
   * The code sits on the shop's colour, not on the card. A QR is a black grid
   * on white and belongs to no brand; the ring around it is what ties this one
   * to the shop whose page it is on.
   */
  qrHalo: { alignItems: 'center', justifyContent: 'center' },
  qrFrame: { padding: QR_QUIET, backgroundColor: '#FFFFFF', borderRadius: 16 },
  qrWords: { gap: space.tight, alignItems: 'center' },
  qrTitle: { ...type.section, color: colors.text, textAlign: 'center' },
  qrBody: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
