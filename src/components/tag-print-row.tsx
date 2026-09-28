import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, colors, space, type } from '@/components/ui-kit';
import { MAX_TAGS, clampTagCount } from '@/lib/domain/tag';

interface TagPrintRowProps {
  onPrint: (count: number) => void;
  isPrinting: boolean;
  disabled?: boolean;
}

/** How many bags, − n +, then one button that prints a tag for each. */
export function TagPrintRow({ onPrint, isPrinting, disabled = false }: TagPrintRowProps) {
  const [count, setCount] = useState(1);
  const change = (next: number) => setCount(clampTagCount(next));
  const canLower = count > 1;
  const canRaise = count < MAX_TAGS;

  return (
    <View style={styles.row}>
      <View
        style={styles.stepper}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Bags, ${count}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') change(count + 1);
          if (event.nativeEvent.actionName === 'decrement') change(count - 1);
        }}
      >
        <Pressable
          accessibilityLabel="One bag fewer"
          disabled={!canLower}
          hitSlop={6}
          onPress={() => change(count - 1)}
          style={[styles.stepButton, !canLower && styles.off]}
        >
          <Ionicons name="remove" size={18} color={colors.action} />
        </Pressable>
        <Text style={styles.count}>{count}</Text>
        <Pressable
          accessibilityLabel="One more bag"
          disabled={!canRaise}
          hitSlop={6}
          onPress={() => change(count + 1)}
          style={[styles.stepButton, !canRaise && styles.off]}
        >
          <Ionicons name="add" size={18} color={colors.action} />
        </Pressable>
      </View>
      <View style={styles.action}>
        <Button
          title={isPrinting ? 'Printing…' : count === 1 ? 'Print tag' : `Print ${count} tags`}
          variant="outline"
          disabled={disabled || isPrinting}
          onPress={() => onPrint(count)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: space.snug,
    minHeight: 48,
  },
  stepButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  count: { ...type.label, color: colors.text, minWidth: 24, textAlign: 'center' },
  action: { flex: 1 },
});
