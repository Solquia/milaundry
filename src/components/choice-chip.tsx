/**
 * One option in a row of chips — a category, how it was paid. Filled when
 * picked, tinted when not; announced as a radio so a screen reader hears the
 * group as one choice.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { RADII, colors, space, type } from './ui-kit';

export function ChoiceChip({
  label,
  icon,
  isOn,
  onPress,
}: {
  label: string;
  icon?: string;
  isOn: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isOn }}
      style={({ pressed }) => [styles.chip, isOn && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      {icon ? <Ionicons name={icon as never} size={15} color={isOn ? colors.onAccent : colors.actionInk} /> : null}
      <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  chipOn: { backgroundColor: colors.action },
  chipText: { ...type.label, color: colors.actionInk },
  chipTextOn: { color: colors.onAccent },
});
