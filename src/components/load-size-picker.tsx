/**
 * How much laundry: a washer door that fills as the load grows, the kilogram
 * ruler to drag, and four bag-sized cards priced on their faces as quick picks
 * for a customer who has never weighed a basket.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loadLevel, loadSizeFor, loadSizes, type LoadSize } from '@/lib/domain/load-size';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';

import { WeightScale } from './quantity-picker';
import { ServicePorthole } from './service-porthole';
import { RADII, colors, space, type } from './ui-kit';

const DOOR_SIZE = 116;

export interface LoadSizePickerProps {
  service: ServiceRow;
  valueKg: number;
  onChange: (kg: number) => void;
  /** The estimated price of a load of this weight, or null when it cannot be priced. */
  priceFor: (kg: number) => string | null;
}

export function LoadSizePicker({ service, valueKg, onChange, priceFor }: LoadSizePickerProps) {
  const sizes = loadSizes(service);
  const current = loadSizeFor(sizes, valueKg);

  const tone = showcaseTone(service.category);
  const price = priceFor(valueKg);
  // A per-load price reads the same on every size; saying it four times is noise.
  const hasPriceSpread = new Set(sizes.map((size) => priceFor(size.kg))).size > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <ServicePorthole
          service={service}
          size={DOOR_SIZE}
          level={loadLevel(sizes, valueKg)}
          waterTint={tone.bg}
          tumbleKey={valueKg}
          isSloshing
          readout={`${valueKg} kg`}
        />
        <View style={styles.stageText}>
          <Text style={styles.sizeName}>{current ? current.label : `${valueKg} kg`}</Text>
          <Text style={styles.sizeHint}>
            {current ? current.hint : 'Your estimate — the shop weighs it'}
          </Text>
          {price ? <Text style={styles.sizePrice}>{price}</Text> : null}
          {current?.isMinimum ? (
            <View style={styles.minimumTag}>
              <Text style={styles.minimumText}>Minimum charge · fits up to {current.kg} kg</Text>
            </View>
          ) : null}
        </View>
      </View>

      <WeightScale valueKg={valueKg} onChange={onChange} />

      <View style={styles.grid}>
        {sizes.map((size) => (
          <SizeCard
            key={size.kg}
            size={size}
            price={hasPriceSpread ? priceFor(size.kg) : null}
            isSelected={current?.kg === size.kg}
            onPress={() => onChange(size.kg)}
          />
        ))}
      </View>
    </View>
  );
}

/** A quick pick: one slim chip, the name and how much it holds. */
function SizeCard({
  size,
  price,
  isSelected,
  onPress,
}: {
  size: LoadSize;
  price: string | null;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${size.label}, up to ${size.kg} kilograms${price ? `, ${price}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <Text style={[styles.cardLabel, isSelected && styles.cardInkSelected]} numberOfLines={1}>
        {size.label}
      </Text>
      <Text style={[styles.cardMeta, isSelected && styles.cardInkSelected]} numberOfLines={1}>
        {size.kg} kg{price ? ` · ${price}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.cosy },
  stage: { flexDirection: 'row', alignItems: 'center', gap: space.room },
  stageText: { flex: 1, minWidth: 0, gap: 2 },
  sizeName: { ...type.value, color: colors.text },
  sizeHint: { ...type.caption, color: colors.subtle },
  sizePrice: { ...type.section, color: colors.actionInk, marginTop: space.tight },
  minimumTag: {
    alignSelf: 'flex-start',
    marginTop: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  minimumText: { ...type.caption, fontSize: 11, color: colors.actionInk },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.tight,
    paddingVertical: 6,
    paddingHorizontal: space.snug,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardSelected: { backgroundColor: colors.action, borderColor: colors.action },
  cardPressed: { transform: [{ scale: 0.97 }] },
  cardLabel: { ...type.caption, fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  cardMeta: { ...type.caption, fontSize: 11, color: colors.subtle },
  cardInkSelected: { color: colors.onAccent },
});
