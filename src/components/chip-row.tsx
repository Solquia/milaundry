/**
 * One row of choices that scrolls, one of them always lit.
 *
 * Five filter chips used to wrap onto two ragged rows at 360dp and cost the
 * screen ninety points above the fold. A single horizontal strip keeps them
 * on one line, bleeds to the page edge so the last chip peeks in as a hint
 * that there are more, and each chip can carry the count of what is behind
 * it — "Unpaid 3" is worth ten times "Unpaid".
 *
 * `solid` is the primary choice on a screen; `ghost` is a secondary facet
 * that should never compete with it.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, space } from './ui-kit';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function ChipRow<K extends string>({
  options,
  value,
  onChange,
  label,
  tone = 'solid',
}: {
  options: readonly ChipOption<K>[];
  value: K;
  onChange: (next: K) => void;
  /** What the row chooses, for screen readers. */
  label: string;
  tone?: 'solid' | 'ghost';
}) {
  const isGhost = tone === 'ghost';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const isSelected = option.key === value;
        const spoken =
          option.count === undefined ? option.label : `${option.label}, ${option.count}`;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={spoken}
            onPress={() => onChange(option.key)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              isGhost && styles.chipGhost,
              isSelected && (isGhost ? styles.chipGhostSelected : styles.chipSelected),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.text,
                isGhost && styles.textGhost,
                isSelected && (isGhost ? styles.textGhostSelected : styles.textSelected),
              ]}
            >
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text
                style={[
                  styles.count,
                  isGhost && styles.textGhost,
                  isSelected && (isGhost ? styles.textGhostSelected : styles.countSelected),
                ]}
              >
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Out to the page edge and back in, so the strip scrolls under the gutter
  // instead of stopping at it.
  bleed: { marginHorizontal: -space.room, flexGrow: 0 },
  row: { flexDirection: 'row', gap: space.snug, paddingHorizontal: space.room },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.room,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.action, borderColor: colors.action },
  chipGhost: {
    minHeight: 34,
    paddingHorizontal: space.cosy,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  chipGhostSelected: { backgroundColor: colors.actionSurface },
  pressed: { opacity: 0.8 },
  text: { fontSize: 14, fontWeight: '600', color: colors.text },
  textSelected: { color: colors.onAccent },
  textGhost: { fontSize: 13, color: colors.subtle },
  textGhostSelected: { color: colors.actionInk },
  count: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  countSelected: { color: colors.onAccent, opacity: 0.85 },
});
