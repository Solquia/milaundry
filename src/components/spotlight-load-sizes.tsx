/**
 * How much laundry, the spotlight way: sizes side by side like cup sizes at a
 * coffee counter, each a little tub of clothes heaped as high as that load,
 * with nothing on it but the kilos. The picked tub fills with the shop's
 * colour, and one quiet line underneath names it and prices it.
 *
 * It only draws; `market-checkout` owns the weight and the exact-weight
 * stepper, so the spotlight and the market cannot size a load differently.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RADII, colors, space, type, useTint } from './ui-kit';
import { loadLevel, type LoadSize } from '@/lib/domain/load-size';

/** Three folds of cloth along the top of the pile. */
const HEAP_BUMPS = [0, 1, 2] as const;
/** The tallest pile stops short of the rim, so its folds stay inside the tub. */
const PILE_CEILING = 0.72;

export interface SpotlightLoadSizesProps {
  sizes: readonly LoadSize[];
  /** The size the weight falls on, or null for a weight between sizes. */
  chosen: LoadSize | null;
  priceFor: (kg: number) => string | null;
  onPick: (kg: number) => void;
}

export function SpotlightLoadSizes({ sizes, chosen, priceFor, onPick }: SpotlightLoadSizesProps) {
  const tint = useTint();
  const price = chosen ? priceFor(chosen.kg) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="How much laundry">
        {sizes.map((size) => {
          const isOn = chosen?.kg === size.kg;
          const sizePrice = priceFor(size.kg);
          return (
            <Pressable
              key={size.kg}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn }}
              accessibilityLabel={`${size.label}, up to ${size.kg} kilograms${sizePrice ? `, ${sizePrice}` : ''}`}
              onPress={() => onPick(size.kg)}
              style={({ pressed }) => [
                styles.tile,
                isOn && { borderColor: tint.ink, backgroundColor: tint.surface },
                pressed && styles.pressed,
              ]}
            >
              <Tub
                level={loadLevel(sizes, size.kg)}
                color={isOn ? tint.fill : colors.border}
                rim={isOn ? tint.ink : colors.borderStrong}
              />
              <Text style={[styles.kg, isOn && { color: tint.ink }]}>
                {size.kg}
                <Text style={styles.kgUnit}> kg</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      {chosen ? (
        <View style={styles.summary}>
          <View style={styles.summaryWords}>
            <Text style={styles.summaryName}>{chosen.label}</Text>
            <Text style={styles.summaryHint}>{`${chosen.hint} · weighed at the shop`}</Text>
          </View>
          {price ? <Text style={[styles.summaryPrice, { color: tint.ink }]}>{price}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A tub with clothes piled to `level` (0–1), folds showing along the top. */
function Tub({ level, color, rim }: { level: number; color: string; rim: string }) {
  const height = `${Math.round(level * PILE_CEILING * 100)}%` as const;
  return (
    <View style={[styles.tub, { borderColor: rim }]}>
      <View style={[styles.pile, { height, backgroundColor: color }]}>
        <View style={styles.heap}>
          {HEAP_BUMPS.map((bump) => (
            <View key={bump} style={[styles.bump, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const BUMP_SIZE = 14;

const styles = StyleSheet.create({
  wrap: { gap: space.cosy },
  row: { flexDirection: 'row', gap: space.snug },
  pressed: { opacity: 0.8 },

  tile: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  tub: {
    width: 40,
    height: 36,
    borderWidth: 2,
    borderTopWidth: 0,
    borderTopLeftRadius: RADII.hair,
    borderTopRightRadius: RADII.hair,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    justifyContent: 'flex-end',
  },
  pile: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  heap: {
    position: 'absolute',
    top: -BUMP_SIZE / 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  bump: { width: BUMP_SIZE, height: BUMP_SIZE, borderRadius: BUMP_SIZE / 2 },

  kg: { ...type.label, fontSize: 17, color: colors.text },
  kgUnit: { ...type.caption, color: colors.subtle },

  summary: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingHorizontal: space.tight },
  summaryWords: { flex: 1, gap: 2 },
  summaryName: { ...type.label, color: colors.text },
  summaryHint: { ...type.caption, color: colors.subtle },
  summaryPrice: { ...type.label, fontSize: 16 },
});
