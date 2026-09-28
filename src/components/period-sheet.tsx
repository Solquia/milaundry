/**
 * Pick the period. Six presets cover how a shop is run; anything older is one
 * tap of the arrows on the card, so there is no calendar to fight with.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PERIOD_PRESETS, isSamePeriod, type SalesPeriod } from '@/lib/domain/sales-period';

import { SalesSheet } from './sales-sheet';
import { RADII, colors, space, type } from './ui-kit';

export function PeriodSheet({
  visible,
  value,
  onChoose,
  onClose,
}: {
  visible: boolean;
  value: SalesPeriod;
  onChoose: (next: SalesPeriod) => void;
  onClose: () => void;
}) {
  return (
    <SalesSheet visible={visible} title="Show sales for" onClose={onClose}>
      <View style={styles.list}>
        {PERIOD_PRESETS.map((preset) => {
          const isOn = isSamePeriod(preset.period, value);
          return (
            <Pressable
              key={preset.label}
              onPress={() => onChoose(preset.period)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isOn }}
              style={({ pressed }) => [styles.row, isOn && styles.rowOn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.label, isOn && styles.labelOn]}>{preset.label}</Text>
              {isOn ? <Ionicons name="checkmark-circle" size={20} color={colors.action} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tip}>
        <Ionicons name="swap-horizontal" size={16} color={colors.subtle} />
        <Text style={styles.tipText}>
          Use the ‹ › arrows on the card to step back through older days, weeks, months or years.
        </Text>
      </View>
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.tight },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: space.room,
    borderRadius: RADII.control,
    backgroundColor: colors.sunken,
  },
  rowOn: { backgroundColor: colors.actionSurface },
  label: { ...type.body, color: colors.text },
  labelOn: { fontWeight: '700', color: colors.actionInk },
  tip: { flexDirection: 'row', gap: space.snug, alignItems: 'flex-start', paddingTop: space.tight },
  tipText: { ...type.caption, color: colors.subtle, flex: 1 },
});