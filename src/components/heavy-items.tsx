/**
 * "Anything thick or heavy?" — the booking's optional extras, one row each.
 *
 * Every extra used to open with a 64pt "0 pieces" readout and a rail of count
 * pills, so two extras took a whole screen to ask a question most customers
 * answer with "no". Now an extra is a single line: its name and price on the
 * left, and on the right an Add button that becomes − count + once tapped.
 * Skipping the card costs nothing; adding a comforter costs one tap.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { extraPriceCaption, extraLimit, stepExtra } from '@/lib/domain/heavy-items';
import { minimumChargeNotice } from '@/lib/domain/price-label';
import { showcaseTitle } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';

import { Card, RADII, colors, fontFor, space, type } from './ui-kit';

/** 44pt: the smallest target a thumb hits without looking twice. */
const TAP = 44;

function RoundButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'add' | 'remove';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.actionInk} />
    </Pressable>
  );
}

function ExtraRow({
  extra,
  quantity,
  onChange,
}: {
  extra: ServiceRow;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const name = showcaseTitle(extra.name);
  const isAdded = quantity > 0;
  const notice = minimumChargeNotice(extra, quantity);
  const unit = extra.unit === 'per_kg' ? ' kg' : '';

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.price, isAdded && styles.priceAdded]}>
          {extraPriceCaption(extra, quantity)}
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      {isAdded ? (
        <View style={styles.stepper}>
          <RoundButton
            icon="remove"
            label={`One less ${name}`}
            onPress={() => onChange(stepExtra(extra.unit, quantity, -1))}
          />
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {quantity}
            {unit}
          </Text>
          <RoundButton
            icon="add"
            label={`One more ${name}`}
            disabled={quantity >= extraLimit(extra.unit)}
            onPress={() => onChange(stepExtra(extra.unit, quantity, 1))}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${name}`}
          onPress={() => onChange(stepExtra(extra.unit, quantity, 1))}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={colors.actionInk} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HeavyItems({
  extras,
  quantities,
  onChange,
}: {
  extras: readonly ServiceRow[];
  quantities: Readonly<Record<string, number>>;
  onChange: (serviceId: string, next: number) => void;
}) {
  if (extras.length === 0) return null;

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>Anything thick or heavy?</Text>
        <Text style={styles.subtitle}>Priced separately. Skip if you have none.</Text>
      </View>
      {extras.map((extra) => (
        <ExtraRow
          key={extra.id}
          extra={extra}
          quantity={quantities[extra.id] ?? 0}
          onChange={(next) => onChange(extra.id, next)}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  title: { ...type.section, color: colors.text },
  subtitle: { ...type.caption, color: colors.subtle },

  /** Name on the left, the control on the right: one line per extra. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.body, fontFamily: fontFor(600), color: colors.text },
  price: { ...type.caption, color: colors.subtle },
  /** Once something is added the line is a running cost, so it takes the ink. */
  priceAdded: { fontFamily: fontFor(700), color: colors.actionInk },
  notice: { ...type.caption, color: colors.actionInk },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: TAP,
    paddingHorizontal: space.room,
    borderRadius: RADII.pill,
    borderWidth: 1.5,
    borderColor: colors.actionInk,
  },
  addText: { ...type.label, fontFamily: fontFor(700), color: colors.actionInk },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  round: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  count: {
    ...type.label,
    fontFamily: fontFor(700),
    minWidth: 28,
    textAlign: 'center',
    color: colors.text,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
});
