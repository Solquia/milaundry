/**
 * The day's target, set once and kept on this device. Three suggested
 * figures, rounded up from the shop's own recent days, so the first goal is
 * a stretch the owner can reach rather than a number pulled from the air.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import { parseGoal } from '@/lib/domain/sales-goal';

import { SalesSheet } from './sales-sheet';
import { Button, ErrorText, Field, RADII, colors, space, type } from './ui-kit';

export function GoalSheet({
  visible,
  goal,
  suggestions,
  onSave,
  onClose,
}: {
  visible: boolean;
  goal: number | null;
  suggestions: readonly number[];
  onSave: (goal: number | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(goal ? String(goal) : '');
  const [error, setError] = useState('');

  const save = () => {
    const parsed = parseGoal(text);
    if (parsed === null) {
      setError('Type the pesos you want to take today, like 5000.');
      return;
    }
    onSave(parsed);
  };

  return (
    <SalesSheet visible={visible} title="Daily sales goal" subtitle="Kept on this device" onClose={onClose}>
      <Field
        label="Goal for each day (₱)"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError('');
        }}
        keyboardType="decimal-pad"
        placeholder="5000"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((value) => (
            <Pressable
              key={value}
              onPress={() => setText(String(value))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.chipText}>{formatMoneyCompact(value)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Save goal" onPress={save} />
      {goal !== null ? <Button title="Remove goal" variant="outline" onPress={() => onSave(null)} /> : null}
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.snug, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  chipText: { ...type.label, color: colors.actionInk },
});