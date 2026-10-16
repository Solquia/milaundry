/**
 * How much laundry: the load itself, the kilogram ruler, and four quick picks.
 *
 * The top is one picture and one sentence. The picture is a real photo of the
 * work (the same cut-out as the service's card), standing on a soft round
 * stand and growing as the load does, so dragging the ruler feels like piling
 * clothes on. Beside it, the answer in words — "One basket", what that looks
 * like at home, and the price. The weight itself is said once, by the ruler's
 * own readout, which is also where a customer types an exact figure.
 *
 * The quick picks are photo cards: the same load once for each basket the
 * size holds, so "Two baskets" looks like two piles before a word is read.
 */
import { Image } from 'expo-image';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadLevel, loadSizeFor, loadSizes, type LoadSize } from '@/lib/domain/load-size';
import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { WeightScale } from './quantity-picker';
import { SERVICE_CUTOUTS } from './service-photo';
import { glassChip, useIsGlass } from './glass';
import { RADII, colors, fontFor, space, type, useTint } from './ui-kit';

/**
 * The stand: a disc with the load standing in it and rising out of its top.
 *
 * The photo is whole and in front of the disc — clipping it to the circle
 * left a hard straight cut wherever a wide pile reached past the rim. Its
 * foot sits low in the disc, so the lower half reads as inside the circle and
 * the top breaks out above it. Every cut-out stands on the same baseline, 86%
 * down its square canvas.
 */
const DISC = 150;
const PHOTO = 230;
/** How far above the disc the stand reaches, for the half that rises out. */
const RISE = 36;
const STAND_WIDTH = PHOTO;
const STAND_HEIGHT = DISC + RISE;
const DISC_LEFT = (STAND_WIDTH - DISC) / 2;
const PHOTO_LEFT = (STAND_WIDTH - PHOTO) / 2;
const PHOTO_FOOT = 0.86;
const BASELINE = RISE + Math.round(DISC * 0.66);
const PHOTO_TOP = Math.round(BASELINE - PHOTO_FOOT * PHOTO);
/** From the photo's centre down to its baseline: what a scale moves, and is moved back by. */
const FOOT_DROP = BASELINE - (PHOTO_TOP + PHOTO / 2);
/** The photo's scale at an empty load and at the largest size. */
const SCALE_EMPTY = 0.8;
const SCALE_FULL = 1;
/** More than this and the baskets on a chip stop reading as a count. */
const MAX_BASKETS_SHOWN = 3;

export interface LoadSizePickerProps {
  service: ServiceRow;
  valueKg: number;
  onChange: (kg: number) => void;
  /** The estimated price of a load of this weight, or null when it cannot be priced. */
  priceFor: (kg: number) => string | null;
}

/** The load on its stand, growing with the weight. */
function LoadStand({ service, photo, level }: { service: ServiceRow; photo: number; level: number }) {
  const isReduced = useReducedMotion();
  const tone = showcaseTone(service.category);
  const [grow] = React.useState(() => new Animated.Value(level));
  React.useEffect(() => {
    if (isReduced) {
      grow.setValue(level);
      return;
    }
    Animated.spring(grow, { toValue: level, damping: 11, stiffness: 160, useNativeDriver: true }).start();
  }, [grow, level, isReduced]);

  const scale = grow.interpolate({ inputRange: [0, 1], outputRange: [SCALE_EMPTY, SCALE_FULL] });
  // Scaling is about the centre; this keeps the foot on the baseline as it grows.
  const settle = grow.interpolate({
    inputRange: [0, 1],
    outputRange: [FOOT_DROP * (1 - SCALE_EMPTY), FOOT_DROP * (1 - SCALE_FULL)],
  });
  return (
    <View style={styles.stand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.standDisc, { backgroundColor: tone.field }]} />
      <Animated.View style={[styles.standPhoto, { transform: [{ translateY: settle }, { scale }] }]}>
        <Image source={photo} style={styles.fill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

export function LoadSizePicker({ service, valueKg, onChange, priceFor }: LoadSizePickerProps) {
  const tint = useTint();
  const sizes = loadSizes(service);
  const current = loadSizeFor(sizes, valueKg);
  const photo = SERVICE_CUTOUTS[sceneFor(service.name, service.category)];

  const price = valueKg > 0 ? priceFor(valueKg) : null;
  // A per-load price reads the same on every size; saying it four times is noise.
  const hasPriceSpread = new Set(sizes.map((size) => priceFor(size.kg))).size > 1;

  const headline = current ? current.label : valueKg > 0 ? 'Your own weight' : 'How much laundry?';
  const hint = current
    ? current.hint
    : valueKg > 0
      ? 'An estimate — the shop weighs it at the counter.'
      : 'Drag the ruler or tap a size. The shop weighs it at the counter.';

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <LoadStand service={service} photo={photo} level={loadLevel(sizes, valueKg)} />
        <View style={styles.stageText} accessibilityLiveRegion="polite">
          <Text style={[styles.eyebrow, { color: tint.ink }]}>YOUR LOAD</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.hint}>{hint}</Text>
          {price ? <Text style={[styles.price, { color: tint.ink }]}>{price}</Text> : null}
          {current?.isMinimum ? (
            <View style={[styles.minimumTag, { backgroundColor: tint.surface }]}>
              <Text style={[styles.minimumText, { color: tint.ink }]}>
                Minimum charge · fits up to {current.kg} kg
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <WeightScale valueKg={valueKg} onChange={onChange} />

      <View style={styles.picks} accessibilityRole="radiogroup">
        {sizes.map((size) => (
          <SizeCard
            key={size.kg}
            photo={photo}
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

/** A quick pick: as many piles as it holds baskets, its name, and its weight. */
function SizeCard({
  photo,
  size,
  price,
  isSelected,
  onPress,
}: {
  photo: number;
  size: LoadSize;
  price: string | null;
  isSelected: boolean;
  onPress: () => void;
}) {
  const tint = useTint();
  const isGlass = useIsGlass();
  const baskets = Math.min(size.baskets, MAX_BASKETS_SHOWN);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${size.label}, up to ${size.kg} kilograms${price ? `, ${price}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pick,
        isGlass && styles.pickGlass,
        isSelected && { borderColor: tint.fill, backgroundColor: tint.surface },
        pressed && styles.pickPressed,
      ]}
    >
      <View style={styles.pickArt} pointerEvents="none">
        {Array.from({ length: baskets }, (_, index) => (
          <Image
            key={index}
            source={photo}
            style={[styles.basket, index > 0 && styles.basketOverlap]}
            contentFit="contain"
          />
        ))}
      </View>
      <Text style={[styles.pickLabel, isSelected && { color: tint.ink }]} numberOfLines={1}>
        {size.label}
      </Text>
      <Text style={styles.pickMeta} numberOfLines={1}>
        {price ?? `${size.kg} kg`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.cosy },
  fill: { width: '100%', height: '100%' },

  // The load centred on top, what it is and what it costs centred under it.
  stage: { alignItems: 'center', gap: space.snug },
  stand: { width: STAND_WIDTH, height: STAND_HEIGHT },
  standDisc: {
    position: 'absolute',
    top: RISE,
    left: DISC_LEFT,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
  },
  standPhoto: {
    position: 'absolute',
    top: PHOTO_TOP,
    left: PHOTO_LEFT,
    width: PHOTO,
    height: PHOTO,
  },
  /** The same photo, placed in the disc's own coordinates. */
  stageText: { alignItems: 'center', gap: 2, maxWidth: 420 },
  eyebrow: { ...type.caption, fontSize: 11, ...fontFor(700), letterSpacing: 1.2 },
  headline: { ...type.value, color: colors.text, textAlign: 'center' },
  hint: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  price: { ...type.section, marginTop: space.tight },
  minimumTag: {
    alignSelf: 'center',
    marginTop: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  minimumText: { ...type.caption, fontSize: 11 },

  picks: { flexDirection: 'row', gap: space.snug },
  pick: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingTop: space.snug,
    paddingBottom: space.snug,
    paddingHorizontal: space.tight,
    borderRadius: RADII.control,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
  },
  pickGlass: { ...glassChip, borderWidth: 1.5 },
  pickPressed: { transform: [{ scale: 0.96 }] },
  pickArt: { flexDirection: 'row', height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  basket: { width: 36, height: 36 },
  basketOverlap: { marginLeft: -18 },
  pickLabel: { ...type.caption, fontSize: 12, ...fontFor(600), color: colors.text },
  pickMeta: { ...type.caption, fontSize: 11, color: colors.subtle },
});
