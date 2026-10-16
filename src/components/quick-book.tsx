/**
 * The home's one-tap reorder: last time's load at the laundry used most
 * recently, landing on a filled review — the marketplace "Buy it again".
 *
 * Set the way iOS sets a suggestion: a white card, an icon tile in the app's
 * blue, the load in the reader's words, and one filled blue capsule that says
 * what pressing it does. No decoration; the blue tile is the identity.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiftPressable } from './lift-pressable';
import { glassPane } from './glass';
import { colors, fontFor, space, type } from './ui-kit';
import type { QuickBook } from '@/lib/domain/recent-shops';

type QuickBookTarget = Exclude<QuickBook, { kind: 'find' }>;

const ICON_TILE = 48;

function quickBookCopy(target: QuickBookTarget): {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
} {
  if (target.kind === 'rebook') {
    return {
      eyebrow: 'Book it again',
      title: target.summary,
      body: target.shopName,
      cta: 'Book',
    };
  }
  return {
    eyebrow: 'Your first load',
    title: `Book at ${target.shopName}`,
    body: "Pick a service and you're nearly done.",
    cta: 'Start',
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
      accessibilityLabel={`${copy.eyebrow}. ${copy.title}, ${copy.body}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.icon}>
        <Ionicons
          name={target.kind === 'rebook' ? 'repeat' : 'basket'}
          size={24}
          color={colors.onAccent}
        />
      </View>
      <View style={styles.words}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {copy.title}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {copy.body}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{copy.cta}</Text>
      </View>
    </LiftPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy + 2,
    padding: space.room,
    ...glassPane,
  },
  icon: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: ICON_TILE * 0.24,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
  },
  words: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { ...type.caption, ...fontFor(600), color: colors.actionInk },
  title: { ...type.body, fontSize: 17, lineHeight: 22, ...fontFor(600), color: colors.text },
  body: { ...type.caption, fontSize: 14, lineHeight: 19, color: colors.subtle },
  cta: {
    minWidth: 68,
    height: 32,
    paddingHorizontal: space.cosy + 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
  },
  ctaText: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2, ...fontFor(700), color: colors.onAccent },
});
