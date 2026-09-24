/**
 * The home's two fast ways into a booking.
 *
 * `QuickBookCard` is the one button on the sheet that books: last time's load
 * at the laundry used most recently, landing on a filled review — two taps
 * from opening the app to a placed order. `RecentShopRow` is each laundry the
 * customer has actually used, with its own "Book again" so the second-most-
 * recent shop is one tap away too.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShopLogo } from './shop-logo';
import { ACCENTS, BLUE_FIELD, colors, elevation, space, type } from './ui-kit';
import { formatOrderTime } from '@/lib/domain/order-card';
import type { QuickBook, RecentShop } from '@/lib/domain/recent-shops';

type QuickBookTarget = Exclude<QuickBook, { kind: 'find' }>;

function quickBookCopy(target: QuickBookTarget): { title: string; body: string } {
  if (target.kind === 'rebook') {
    return { title: 'Same as last time', body: `${target.summary} · ${target.shopName}` };
  }
  return { title: `Book at ${target.shopName}`, body: "Pick a service and you're nearly done." };
}

export function QuickBookCard({
  target,
  onPress,
}: {
  target: QuickBookTarget;
  onPress: () => void;
}) {
  const copy = quickBookCopy(target);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quick book. ${copy.title}. ${copy.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name="flash" size={20} color={BLUE_FIELD.mid} />
      </View>
      <View style={styles.words}>
        <Text style={styles.quickEyebrow}>QUICK BOOK</Text>
        <Text style={styles.quickTitle} numberOfLines={1}>
          {copy.title}
        </Text>
        <Text style={styles.quickBody} numberOfLines={1}>
          {copy.body}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
    </Pressable>
  );
}

export function RecentShopRow({
  shop,
  accent,
  onOpen,
  onBook,
}: {
  shop: RecentShop;
  accent: (typeof ACCENTS)[number];
  onOpen: () => void;
  /** Absent when nothing from this shop can be booked again. */
  onBook?: () => void;
}) {
  const when = formatOrderTime(shop.lastOrderAt, new Date());
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}, last order ${when}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <ShopLogo name={shop.name} logoUrl={shop.logoUrl} size={44} accent={accent} />
        <View style={styles.words}>
          <Text style={styles.rowName} numberOfLines={1}>
            {shop.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {shop.lastSummary ? `${shop.lastSummary} · ${when}` : `Last order ${when}`}
          </Text>
        </View>
      </Pressable>
      {onBook && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Book again at ${shop.name}`}
          hitSlop={6}
          onPress={onBook}
          style={({ pressed }) => [styles.again, pressed && styles.pressed]}
        >
          <Text style={styles.againText}>Book again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** The one filled shape on the sheet, in the home's own blue. */
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
    borderRadius: 18,
    backgroundColor: BLUE_FIELD.mid,
    ...elevation.lift,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onAccent,
  },
  words: { flex: 1, gap: 2 },
  quickEyebrow: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickTitle: { ...type.label, fontSize: 17, color: colors.onAccent },
  quickBody: { ...type.caption, color: 'rgba(255, 255, 255, 0.9)' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.cosy,
    ...elevation.rest,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  rowName: { ...type.label, fontSize: 16, color: colors.text },
  rowMeta: { ...type.caption, color: colors.subtle },
  /** 38pt tall plus the slop clears the 44pt minimum. */
  again: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.cosy,
    borderRadius: 999,
    backgroundColor: colors.actionSurface,
  },
  againText: { ...type.label, fontSize: 13, color: colors.actionInk },
  pressed: { opacity: 0.75 },
});
