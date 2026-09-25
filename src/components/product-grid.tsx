/**
 * The booking's shelf, laid out like a shop's product listing: a grid of
 * cards, each a square photo, a name, a line on what it is, and a price.
 *
 * It replaced two things. The shop's add-ons swiped sideways in a rail, so
 * most of the shelf sat off the right edge and a customer had to go looking
 * for the soap they wanted. The free preference tiles wrapped by measured
 * width and, on the web, stranded the third tile of every row on the next
 * line. Both are now this grid: every product on the page at once, three to a
 * phone row, rows padded so the last card is the width of the others.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SHELF_GAP, shelfColumns } from '@/lib/domain/shop-addons';
import { gridRows } from '@/lib/domain/web-layout';

import { RADII, colors, elevation, fontFor, space, type } from './ui-kit';

const FREE_INK = '#0B7A4B';

export function ProductGrid<T>({
  items,
  keyOf,
  renderItem,
  accessibilityRole,
  accessibilityLabel,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  accessibilityRole?: 'radiogroup' | 'list';
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const columns = shelfColumns(width);
  return (
    <View
      style={styles.grid}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {gridRows(items, columns).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item, column) => (
            <View key={item === null ? `blank-${column}` : keyOf(item)} style={styles.cell}>
              {item === null ? null : renderItem(item)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * One product. Tapping anywhere on it puts it on the load or takes it off; the
 * round button in the photo's corner says which, the way a shop's "+" does.
 */
export function ProductCard({
  picture,
  name,
  note,
  price,
  isOn,
  role,
  accessibilityLabel,
  onPress,
  children,
}: {
  /** Drawn under the price: a quantity stepper, when the item takes one. */
  children?: React.ReactNode;
  /** Fills the square photo well. */
  picture: React.ReactNode;
  name: string;
  note?: string;
  /** "+₱15.00", "Free", or nothing for a choice that is not sold. */
  price?: string;
  isOn: boolean;
  role: 'radio' | 'checkbox';
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const label = accessibilityLabel ?? [name, note, price].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected: isOn } : { checked: isOn }}
      accessibilityLabel={label}
      accessibilityHint={isOn ? 'Takes it off this load' : 'Puts it on this load'}
      onPress={onPress}
      style={({ pressed }) => [styles.card, isOn && styles.cardOn, pressed && styles.pressed]}
    >
      <View style={styles.photo}>
        {picture}
        <View style={[styles.addDot, isOn && styles.addDotOn]}>
          <Ionicons
            name={isOn ? 'checkmark' : 'add'}
            size={16}
            color={isOn ? colors.onAccent : colors.action}
          />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, isOn && styles.nameOn]} numberOfLines={2}>
          {name}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        {price ? (
          <Text style={[styles.price, price === 'Free' && styles.priceFree]}>{price}</Text>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SHELF_GAP },
  row: { flexDirection: 'row', gap: SHELF_GAP },
  cell: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...elevation.rest,
  },
  /** On the load: the action blue round the card and a wash of it behind the text. */
  cardOn: { borderColor: colors.action, backgroundColor: colors.actionSurface },
  pressed: { transform: [{ scale: 0.97 }] },
  photo: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addDot: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.action,
    ...elevation.rest,
  },
  addDotOn: { backgroundColor: colors.action },
  body: { paddingHorizontal: space.snug, paddingTop: 6, paddingBottom: space.snug, gap: 1 },
  name: { ...type.label, fontSize: 13, lineHeight: 17, color: colors.text },
  nameOn: { color: colors.actionInk },
  note: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  price: {
    ...type.label,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
    fontFamily: fontFor(800),
    color: colors.text,
  },
  priceFree: { color: FREE_INK },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.tight,
    borderRadius: RADII.pill,
    borderWidth: 1.5,
    borderColor: colors.action,
    backgroundColor: colors.card,
  },
  stepButton: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center' },
  stepButtonOff: { opacity: 0.35 },
  stepCount: { ...type.label, fontSize: 14, fontFamily: fontFor(800), color: colors.text },
});

/**
 * How many of one product: − n +, sized to sit inside a card. "−" at one
 * takes the product off, the same as tapping the card again.
 */
export function QuantityStepper({
  name,
  value,
  max,
  onChange,
}: {
  name: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const isAtMax = value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value <= 1 ? `Remove ${name}` : `One less ${name}`}
        hitSlop={6}
        onPress={() => onChange(value - 1)}
        style={styles.stepButton}
      >
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={16} color={colors.action} />
      </Pressable>
      <Text style={styles.stepCount} accessibilityLabel={`${value} of ${name}, up to ${max}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`One more ${name}`}
        accessibilityState={{ disabled: isAtMax }}
        disabled={isAtMax}
        hitSlop={6}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, isAtMax && styles.stepButtonOff]}
      >
        <Ionicons name="add" size={16} color={colors.action} />
      </Pressable>
    </View>
  );
}
