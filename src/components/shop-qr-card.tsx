/**
 * The shop's QR, folded away until it is wanted.
 *
 * It used to be the first thing on the Customers tab, 220 points of code that
 * the owner shares once and then scrolls past every day. Now it is a single
 * row that opens on demand, and the people who scanned it get the screen.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildShopQr } from '@/lib/domain/qr';
import type { Shop } from '@/lib/types';

import { Button, CROWN, RADII, colors, space, type } from './ui-kit';

export function ShopQrCard({ shop }: { shop: Shop }) {
  const [isOpen, setOpen] = useState(false);
  const shopQr = buildShopQr(shop.id, shop.qr_token);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Hide your shop QR' : 'Show your shop QR'}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setOpen((open) => !open)}
        style={styles.row}
      >
        <View style={styles.mark}>
          <Ionicons name="qr-code-outline" size={20} color={colors.actionInk} />
        </View>
        <View style={styles.words}>
          <Text style={styles.title}>Your shop QR</Text>
          <Text style={styles.caption}>Customers scan it to connect and book online</Text>
        </View>
        <Text style={styles.toggle}>{isOpen ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.body}>
          <View style={styles.frame}>
            <QRCode value={shopQr} size={200} />
          </View>
          <Button
            title="Share shop link"
            variant="outline"
            onPress={() =>
              Share.share({ message: `Connect to ${shop.name} on MiLaundry: ${shopQr}` })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.cosy },
  mark: {
    width: 40,
    height: 40,
    borderRadius: RADII.card,
    backgroundColor: colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  toggle: { ...type.label, color: colors.actionInk, paddingHorizontal: space.tight },
  body: {
    gap: space.cosy,
    padding: space.room,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  frame: { alignItems: 'center', paddingVertical: space.snug },
});
