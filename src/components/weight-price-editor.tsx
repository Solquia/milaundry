/**
 * The owner's weight table for one service: "up to 8 kg ₱185, up to 8.5 kg
 * ₱200 …", typed as rows the way it is printed on the wall.
 *
 * Shown when the owner sets the price by weight table. Filled in, the
 * booking, the counter and the server all price a load by the first row it
 * fits under (`weight-prices.ts`, `public.weight_price`), so a wrong row is
 * fixed here and nowhere else.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_WEIGHT_ROWS, type WeightPrice, type WeightPriceDraft } from '@/lib/domain/weight-prices';

import { RADII, colors, fontFor, space, type } from './ui-kit';

/** A saved table, opened as editable text rows. */
export function draftsFromWeightPrices(rows: readonly WeightPrice[] | undefined): WeightPriceDraft[] {
  return (rows ?? []).map((row) => ({ upTo: String(row.up_to_kg), price: String(row.price) }));
}

export function WeightPriceEditor({
  rows,
  onChange,
  error,
}: {
  rows: WeightPriceDraft[];
  onChange: (rows: WeightPriceDraft[]) => void;
  error?: string;
}) {
  const setRow = (index: number, patch: Partial<WeightPriceDraft>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => onChange(rows.filter((_, at) => at !== index));
  const addRow = () => onChange([...rows, { upTo: '', price: '' }]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.help}>
        One row for each weight on your price board, such as up to 8 kg ₱185, up to 8.5 kg ₱200. The
        laundry is charged the first row it fits under, and anything heavier than the last row is
        charged the last row.
      </Text>
      {rows.length > 0 ? (
        <View style={styles.headRow}>
          <Text style={[styles.headText, styles.weightCol]}>Up to (kg)</Text>
          <Text style={[styles.headText, styles.priceCol]}>Price (₱)</Text>
          <View style={styles.removeCol} />
        </View>
      ) : null}
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <TextInput
            value={row.upTo}
            onChangeText={(upTo) => setRow(index, { upTo })}
            keyboardType="decimal-pad"
            placeholder="8"
            placeholderTextColor={colors.subtle}
            accessibilityLabel={`Row ${index + 1}, up to how many kilos`}
            style={[styles.input, styles.weightCol]}
          />
          <TextInput
            value={row.price}
            onChangeText={(price) => setRow(index, { price })}
            keyboardType="decimal-pad"
            placeholder="185"
            placeholderTextColor={colors.subtle}
            accessibilityLabel={`Row ${index + 1}, price`}
            style={[styles.input, styles.priceCol]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove row ${index + 1}`}
            onPress={() => removeRow(index)}
            hitSlop={8}
            style={({ pressed }) => [styles.removeCol, styles.remove, pressed && styles.pressed]}
          >
            <Ionicons name="close-circle" size={22} color={colors.subtle} />
          </Pressable>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.length < MAX_WEIGHT_ROWS ? (
        <Pressable
          accessibilityRole="button"
          onPress={addRow}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={colors.actionInk} />
          <Text style={styles.addText}>{rows.length === 0 ? 'Add a weight price' : 'Add a row'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.snug },
  help: { ...type.caption, color: colors.subtle },
  headRow: { flexDirection: 'row', gap: space.snug },
  headText: { ...type.caption, fontFamily: fontFor(600), color: colors.subtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  weightCol: { flex: 1 },
  priceCol: { flex: 1.3 },
  removeCol: { width: 28, alignItems: 'center' },
  remove: { justifyContent: 'center', height: 44 },
  input: {
    ...type.body,
    minHeight: 44,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  error: { ...type.caption, color: colors.dangerInk },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.tight,
    minHeight: 40,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.actionMuted,
  },
  addText: { ...type.label, color: colors.actionInk },
  pressed: { opacity: 0.6 },
});
