/**
 * The customer book in one glance, and the one thing to do about it.
 *
 * Four stat tiles used to stand between the owner and the list: three
 * hundred points of card, one of them repeating the Earnings tab, one of them
 * saying "0 · worth a message" with nothing to press. Now it is a single
 * strip of three figures, and the figures that point at people are doors —
 * tap what is owed and the list shows who owes it. The follow-up nudge only
 * appears when there is someone to follow up.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LAPSED_AFTER_DAYS,
  type CustomerBookSummary,
  type CustomerSegment,
} from '@/lib/domain/customer-insights';

import { RADII, TAG_TONES, colors, elevation, formatMoney, space, type } from './ui-kit';

const people = (count: number): string => `${count} ${count === 1 ? 'person' : 'people'}`;

type Figure = {
  value: string;
  label: string;
  ink?: string;
  onPress?: () => void;
  spoken: string;
};

function Cell({ value, label, ink = colors.text, onPress, spoken }: Figure) {
  const body = (
    <>
      <Text style={[styles.value, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.cell} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function CustomerPulse({
  summary,
  onSegment,
}: {
  summary: CustomerBookSummary;
  onSegment: (segment: CustomerSegment) => void;
}) {
  const isOwed = summary.owed > 0;

  return (
    <View style={styles.stack}>
      <View style={styles.strip}>
        <Cell
          value={String(summary.total)}
          label={`${summary.ordering} ordered`}
          spoken={`${people(summary.total)} in your book, ${summary.ordering} have ordered`}
          onPress={() => onSegment('all')}
        />
        <View style={styles.rule} />
        <Cell
          value={`${summary.repeatRate}%`}
          label="come back"
          spoken={`${summary.repeatRate} percent came back at least once`}
        />
        <View style={styles.rule} />
        <Cell
          value={isOwed ? formatMoney(summary.owed) : 'All paid'}
          label={isOwed ? `owed by ${summary.owing}` : 'nobody owes'}
          ink={isOwed ? colors.moneyOut : colors.moneyIn}
          spoken={
            isOwed
              ? `${formatMoney(summary.owed)} owed by ${people(summary.owing)}. Show them.`
              : 'Nobody owes you money'
          }
          onPress={isOwed ? () => onSegment('owing') : undefined}
        />
      </View>
      {summary.lapsed > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${people(summary.lapsed)} not seen in ${LAPSED_AFTER_DAYS} days. Show them.`}
          onPress={() => onSegment('lapsed')}
          style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
        >
          <Ionicons name="hand-left-outline" size={16} color={TAG_TONES.owed.ink} />
          <Text style={styles.nudgeText} numberOfLines={1}>
            {people(summary.lapsed)} not seen in {LAPSED_AFTER_DAYS} days
          </Text>
          <Text style={styles.nudgeAction}>Say hi</Text>
          <Ionicons name="chevron-forward" size={14} color={TAG_TONES.owed.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.snug },
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: space.cosy,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.card,
  },
  rule: { width: StyleSheet.hairlineWidth, marginVertical: space.cosy, backgroundColor: colors.border },
  pressed: { opacity: 0.7 },
  value: { ...type.value, fontSize: 20, letterSpacing: -0.3 },
  label: { ...type.caption, color: colors.subtle },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    minHeight: 40,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: TAG_TONES.owed.bg,
  },
  nudgeText: { flex: 1, ...type.caption, fontWeight: '600', color: TAG_TONES.owed.ink },
  nudgeAction: { ...type.caption, fontWeight: '700', color: TAG_TONES.owed.ink },
});
