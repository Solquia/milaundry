/**
 * One figure with its name and a line of context, two to a row.
 *
 * Tone follows the app's three colour statements: green is money that came
 * in, amber is money still owed, and everything else stays in plain ink so
 * the one tile that matters is the one that carries colour.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RADII, colors, space, type } from './ui-kit';

export type StatTone = 'plain' | 'in' | 'owed';

const TONE_INK: Record<StatTone, string> = {
  plain: colors.text,
  in: colors.moneyIn,
  owed: colors.moneyOut,
};

export function StatTile({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={hint ? `${label}: ${value}. ${hint}` : `${label}: ${value}`}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: TONE_INK[tone] }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.cosy },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: space.tight,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...type.caption, fontWeight: '600', color: colors.subtle },
  value: { ...type.value, letterSpacing: -0.2 },
  hint: { ...type.caption, color: colors.subtle },
});
