/**
 * The walk-in till's "on the house" switch. The owner or staff decides, at
 * the counter, that this ticket is free laundry; the order is saved and the
 * whole bill comes off it (give_free_laundry, 0048). It does not use up a
 * stamp, and the visit still counts on the customer's loyalty card.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, formatMoney, space, type } from './ui-kit';

type Props = {
  isOn: boolean;
  total: number | null;
  onChange: (next: boolean) => void;
};

export function FreeLaundryToggle({ isOn, total, onChange }: Props) {
  const off = total === null ? '' : ` (${formatMoney(total)} off)`;
  const note = isOn
    ? `On the house: the customer pays nothing${off}.`
    : 'Your call. Turn on to give this ticket free.';
  return (
    <View style={[styles.row, isOn && styles.rowOn]}>
      <Ionicons name="gift" size={22} color={isOn ? colors.moneyIn : colors.actionInk} />
      <View style={styles.text}>
        <Text style={styles.title}>Free laundry</Text>
        <Text style={[styles.note, isOn && styles.noteOn]}>{note}</Text>
      </View>
      <Switch
        accessibilityLabel="Free laundry"
        value={isOn}
        onValueChange={onChange}
        trackColor={{ true: colors.moneyIn, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  rowOn: { borderColor: colors.moneyIn },
  text: { flex: 1, gap: 2 },
  title: { ...type.label, color: colors.text },
  note: { ...type.caption, color: colors.subtle },
  noteOn: { color: colors.moneyIn, fontWeight: '700' },
});
