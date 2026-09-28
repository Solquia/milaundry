/**
 * The home's one-tap reorder: last time's load at the laundry used most
 * recently, landing on a filled review — the marketplace "Buy it again".
 *
 * It used to be a pale tinted strip under the shop lists, below two rows that
 * already had their own "Book again" buttons, so the fastest way to book was
 * also the least visible thing on the sheet. It is now the one filled block on
 * the sheet, straight after anything in the wash: reordering is what most
 * visits to a laundry app are for.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiftPressable } from './lift-pressable';
import { colors, elevation, space, type } from './ui-kit';
import type { QuickBook } from '@/lib/domain/recent-shops';

type QuickBookTarget = Exclude<QuickBook, { kind: 'find' }>;

/** The porthole cropped into the card's corner. */
const PORTHOLE = 150;

function quickBookCopy(target: QuickBookTarget): {
  eyebrow: string;
  title: string;
  body: string;
} {
  if (target.kind === 'rebook') {
    return { eyebrow: 'Book it again', title: target.summary, body: `at ${target.shopName}` };
  }
  return {
    eyebrow: 'Your first load',
    title: `Book at ${target.shopName}`,
    body: "Pick a service and you're nearly done.",
  };
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
    <LiftPressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.eyebrow}. ${copy.title} ${copy.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* A drum's porthole, cropped by the card's corner: the one piece of
          decoration on the sheet, and it is the app's own motif. */}
      <View style={styles.porthole} pointerEvents="none" />
      <View style={styles.portholeGlass} pointerEvents="none" />

      <View style={styles.icon}>
        <Ionicons
          name={target.kind === 'rebook' ? 'refresh' : 'basket'}
          size={22}
          color={colors.action}
        />
      </View>
      <View style={styles.words}>
        <Text style={styles.eyebrow}>{copy.eyebrow.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {copy.title}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {copy.body}
        </Text>
      </View>
      <View style={styles.go}>
        <Ionicons name="arrow-forward" size={18} color={colors.action} />
      </View>
    </LiftPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
    borderRadius: 22,
    backgroundColor: colors.action,
    overflow: 'hidden',
    ...elevation.lift,
  },
  porthole: {
    position: 'absolute',
    right: -PORTHOLE / 3,
    top: -PORTHOLE / 2.5,
    width: PORTHOLE,
    height: PORTHOLE,
    borderRadius: PORTHOLE / 2,
    borderWidth: 18,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  portholeGlass: {
    position: 'absolute',
    right: -PORTHOLE / 3 + 34,
    top: -PORTHOLE / 2.5 + 34,
    width: PORTHOLE - 68,
    height: PORTHOLE - 68,
    borderRadius: PORTHOLE,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  words: { flex: 1, gap: 1 },
  eyebrow: {
    ...type.caption,
    fontSize: 11,
    letterSpacing: 1.1,
    fontFamily: type.label.fontFamily,
    color: 'rgba(255,255,255,0.78)',
  },
  title: { ...type.label, fontSize: 17, lineHeight: 22, color: colors.onAccent },
  body: { ...type.caption, color: 'rgba(255,255,255,0.88)' },
  go: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.88 },
});
