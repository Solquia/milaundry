/**
 * A pill of two or three choices where exactly one is the answer.
 *
 * The Prices tab drew its Services / Add-ons switch this way, and the pricing
 * unit as three full-width buttons — one of them filled, so the chosen unit
 * looked exactly like the Add service button below it. Both are now this one
 * control: a choice reads as a choice, and only the real action is a button.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, space, type } from './ui-kit';

type SegmentedProps<T extends string> = {
  options: readonly { key: T; label: string }[];
  /** `null` while nothing has been chosen yet. */
  value: T | null;
  onChange: (next: T) => void;
  accessibilityRole?: 'tablist' | 'radiogroup';
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityRole = 'tablist',
}: SegmentedProps<T>) {
  const itemRole = accessibilityRole === 'tablist' ? 'tab' : 'radio';
  return (
    <View style={styles.track} accessibilityRole={accessibilityRole}>
      {options.map((option) => {
        const isSelected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole={itemRole}
            accessibilityState={
              itemRole === 'tab' ? { selected: isSelected } : { checked: isSelected }
            }
            onPress={() => onChange(option.key)}
            style={[styles.option, isSelected && styles.optionOn]}
          >
            <Text style={[styles.text, isSelected && styles.textOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: space.tight,
    padding: space.tight,
    borderRadius: 999,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: space.snug,
    borderRadius: 999,
  },
  optionOn: { backgroundColor: colors.card, ...elevation.rest },
  text: { ...type.label, color: colors.subtle },
  textOn: { color: colors.actionInk },
});
