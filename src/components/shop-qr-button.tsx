/**
 * The shop's QR, one square key beside the search box.
 *
 * It used to be a full-width card at the top of the Customers tab — the first
 * thing the owner saw every day, for a code they share once. Now it is a key
 * that opens a sheet: the code big enough to scan off the phone across the
 * counter, and a share button for the group chat.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildShopQr } from '@/lib/domain/qr';
import type { Shop } from '@/lib/types';

import { Button, RADII, colors, space, type } from './ui-kit';

const QR_SIZE = 220;

export function ShopQrButton({ shop }: { shop: Shop }) {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show your shop QR"
        accessibilityHint="Customers scan it to connect and book online"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.key, pressed && styles.pressed]}
      >
        <Ionicons name="qr-code-outline" size={20} color={colors.actionInk} />
      </Pressable>
      {isOpen ? <ShopQrSheet shop={shop} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ShopQrSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const shopQr = buildShopQr(shop.id, shop.qr_token);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the shop QR"
          onPress={onClose}
          style={styles.scrim}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.room) }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <Text style={styles.title}>{shop.name}</Text>
            <Text style={styles.subtitle}>Scan to connect and book online</Text>
          </View>
          <View style={styles.frame} accessible accessibilityLabel={`QR code for ${shop.name}`}>
            <QRCode value={shopQr} size={QR_SIZE} />
          </View>
          <Button
            title="Share shop link"
            variant="outline"
            onPress={() =>
              Share.share({ message: `Connect to ${shop.name} on MiLaundry: ${shopQr}` })
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  key: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  pressed: { opacity: 0.75 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11, 27, 43, 0.45)' },
  scrim: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.room,
    paddingTop: space.snug,
    gap: space.room,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  head: { alignItems: 'center', gap: 2 },
  title: { ...type.section, color: colors.text, textAlign: 'center' },
  subtitle: { ...type.body, color: colors.subtle, textAlign: 'center' },
  frame: { alignItems: 'center', paddingVertical: space.snug },
});
