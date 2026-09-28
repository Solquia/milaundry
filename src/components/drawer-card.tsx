/**
 * Where the money is sitting: the drawer, and each wallet, like the balance
 * card on a seller app. Cash is the one figure that has to match something
 * physical, so today's card ends in "Close the day": count the drawer, see
 * over or short, print the Z-report.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, formatMoneyCompact } from '@/lib/domain/money';
import type { MethodShare } from '@/lib/domain/sales-metrics';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';
import type { SavedClose } from '@/lib/sales-store';

import { RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

const METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: 'cash-outline',
  gcash: 'phone-portrait-outline',
  maya: 'phone-portrait-outline',
  card: 'card-outline',
  bank_transfer: 'business-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

function closedLine(close: SavedClose): string {
  const time = new Date(close.closedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (close.tone === 'even') return `Closed at ${time} · drawer even`;
  return `Closed at ${time} · drawer ${close.tone} ${formatMoney(Math.abs(close.difference))}`;
}

export function DrawerCard({
  methods,
  canClose,
  savedClose,
  onCloseDay,
}: {
  methods: readonly MethodShare[];
  canClose: boolean;
  savedClose: SavedClose | null;
  onCloseDay: () => void;
}) {
  return (
    <View style={styles.card}>
      {methods.length === 0 ? (
        <Text style={styles.empty}>No money in yet for this period.</Text>
      ) : (
        <View style={styles.grid}>
          {methods.map((method) => (
            <View
              key={method.key}
              style={[styles.wallet, method.key === 'cash' && styles.walletCash]}
              accessible
              accessibilityLabel={`${method.label}: ${formatMoney(method.amount)}, ${method.share} percent`}
            >
              <View style={styles.walletHead}>
                <Ionicons name={METHOD_ICONS[method.key] as never} size={15} color={colors.subtle} />
                <Text style={styles.walletLabel} numberOfLines={1}>
                  {method.label}
                </Text>
                <Text style={styles.share}>{method.share}%</Text>
              </View>
              <Text style={styles.walletAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoneyCompact(method.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {canClose ? (
        <>
          {savedClose ? (
            <View
              style={[
                styles.closed,
                { backgroundColor: savedClose.tone === 'short' ? TAG_TONES.owed.bg : TAG_TONES.settled.bg },
              ]}
            >
              <Ionicons
                name={savedClose.tone === 'short' ? 'alert-circle' : 'checkmark-circle'}
                size={16}
                color={savedClose.tone === 'short' ? TAG_TONES.owed.ink : TAG_TONES.settled.ink}
              />
              <Text
                style={[
                  styles.closedText,
                  { color: savedClose.tone === 'short' ? TAG_TONES.owed.ink : TAG_TONES.settled.ink },
                ]}
              >
                {closedLine(savedClose)}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={onCloseDay}
            accessibilityRole="button"
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="lock-closed-outline" size={17} color={colors.onAccent} />
            <Text style={styles.closeText}>{savedClose ? 'Count again' : 'Close the day'}</Text>
            <Text style={styles.closeHint}>Z-report</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.cosy, padding: space.room, borderRadius: RADII.card, backgroundColor: colors.card, ...elevation.rest },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  wallet: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    padding: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletCash: { backgroundColor: colors.takingsSurface, borderColor: colors.takingsBorder },
  walletHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  walletLabel: { ...type.caption, fontWeight: '600', color: colors.subtle, flex: 1 },
  share: { ...type.caption, fontSize: 11, color: colors.subtle },
  walletAmount: { ...type.value, fontSize: 20, color: colors.text },
  empty: { ...type.body, color: colors.subtle },
  closed: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.snug, borderRadius: RADII.chip },
  closedText: { ...type.caption, fontWeight: '600', flex: 1 },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    minHeight: 48,
    borderRadius: RADII.control,
    backgroundColor: colors.text,
  },
  closeText: { ...type.label, fontSize: 15, color: colors.onAccent },
  closeHint: {
    ...type.caption,
    fontSize: 11,
    color: colors.onAccent,
    opacity: 0.7,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADII.hair,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});