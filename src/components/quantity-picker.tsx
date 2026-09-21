import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useReducedMotion } from '@/lib/use-reduced-motion';

import { MAX_WEIGHT_KG, WEIGHT_STEP_KG } from '@/lib/domain/booking-estimate';
import { mixHex, tickEmphasis, withAlpha } from '@/lib/domain/brand-gradient';
import {
  MAX_PIECES,
  TICK_SPACING,
  clampPieces,
  offsetForWeight,
  parseTypedWeight,
  pieceOptions,
  rulerTicks,
  tickKind,
  weightForOffset,
} from '@/lib/domain/quantity-input';

import { Odometer } from './odometer';
import { RADII, colors, space, type } from './ui-kit';

const TICK_HEIGHTS = { major: 26, minor: 17, micro: 10 } as const;

/**
 * How far either side of the needle the ruler is lit, in kilos.
 *
 * Wide enough that the pool has a shape — a single lit tick is a cursor, not
 * light — and narrow enough that the far end of a 30kg ruler stays quiet.
 */
const LIT_REACH_KG = 3;

/**
 * The colour these controls are wearing.
 *
 * The app draws them in its own blue; a shop's web page draws the same two
 * controls in the shop's accent, because on that page the scale *is* the
 * storefront. One prop rather than two components.
 */
export interface QuantityTone {
  /** The solid: needle, lit ticks, a chosen pill. */
  brand: string;
  /** The pale field the ruler is cut into. */
  soft: string;
  /** Brand as text on `soft`. */
  ink: string;
}

export const APP_TONE: QuantityTone = {
  brand: colors.action,
  soft: colors.actionSurface,
  ink: colors.actionInk,
};

/**
 * A weighing scale you drag.
 *
 * The customer is being asked to guess how heavy a laundry basket is, which is
 * the hardest question in the booking flow. A ruler sliding under a fixed
 * centre mark lets them sweep to "about right" in one gesture instead of
 * tapping a half kilo at a time, and it makes the scale metaphor structural
 * rather than a decorative icon.
 */
export function WeightScale({
  valueKg,
  onChange,
  maxKg = MAX_WEIGHT_KG,
  tone = APP_TONE,
}: {
  valueKg: number;
  onChange: (kg: number) => void;
  maxKg?: number;
  tone?: QuantityTone;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  /** True while the user's own gesture drives the value, so the effect below
      does not fight the finger by scrolling back to where it thinks we are. */
  const isDragging = useRef(false);
  /**
   * The weight the ruler is physically showing. A value change that came *from*
   * the ruler needs no scroll to catch up with it; without this, every reading
   * the ruler reported was echoed back as a scroll command, and a flick or a
   * quick chip set the ruler rocking between two positions.
   */
  const shownKg = useRef(valueKg);
  /** Where a programmatic scroll is heading, so its in-flight frames are not
      read back as the user changing their mind. */
  const scrollTarget = useRef<number | null>(null);
  const hasPositioned = useRef(false);

  const ticks = rulerTicks(maxKg, WEIGHT_STEP_KG);
  const [draft, setDraft] = useState<string | null>(null);
  const isTyping = draft !== null;

  const startTyping = () => {
    if (!isTyping) setDraft(valueKg.toFixed(1));
  };

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseTypedWeight(draft, maxKg);
    setDraft(null);
    if (parsed !== null && parsed !== valueKg) onChange(parsed);
  };

  // A chip or the ruler is a new reading; drop the keypad so the two cannot
  // disagree about what the scale says.
  useEffect(() => {
    setDraft(null);
  }, [valueKg]);

  // Follow the value when something else sets it — a quick chip, or a reset.
  useEffect(() => {
    if (isDragging.current || trackWidth === 0) return;
    if (valueKg === shownKg.current && hasPositioned.current) return;
    const x = offsetForWeight(valueKg, WEIGHT_STEP_KG, TICK_SPACING);
    scrollTarget.current = x;
    // The first placement is a jump, not a sweep: a sheet that opens at 5 kg
    // should open *at* 5 kg rather than travel there from zero.
    scrollRef.current?.scrollTo({ x, animated: hasPositioned.current });
    hasPositioned.current = true;
  }, [valueKg, trackWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const readValue = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isTyping) return;
    const offset = event.nativeEvent.contentOffset.x;
    const target = scrollTarget.current;
    if (target !== null) {
      // Still travelling under our own command: only the arrival counts.
      if (Math.abs(offset - target) > TICK_SPACING / 2) return;
      scrollTarget.current = null;
    }
    const next = weightForOffset(offset, WEIGHT_STEP_KG, TICK_SPACING, maxKg);
    shownKg.current = next;
    if (next !== valueKg) onChange(next);
  };

  const beginDrag = () => {
    isDragging.current = true;
    // The finger outranks any scroll we had in flight.
    scrollTarget.current = null;
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    readValue(event);
  };

  const nudge = (delta: number) => {
    onChange(
      weightForOffset(
        offsetForWeight(valueKg + delta, WEIGHT_STEP_KG, TICK_SPACING),
        WEIGHT_STEP_KG,
        TICK_SPACING,
        maxKg
      )
    );
  };

  return (
    <View style={styles.scaleBlock}>
      {/* The reading, on a plinth of the shop's own colour. It used to be
          black text floating above the ruler, which made the number a caption
          for the control rather than the thing the control produces. */}
      {isTyping ? (
        <View style={[styles.readout, { backgroundColor: withAlpha(tone.brand, 0.07) }]}>
          <View style={styles.readoutRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={commitDraft}
              onSubmitEditing={commitDraft}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoFocus
              selectTextOnFocus
              accessibilityLabel="Weight in kilograms"
              style={styles.readoutInput}
              returnKeyType="done"
            />
            <Text style={[styles.readoutUnit, { color: tone.ink }]}>kg</Text>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${valueKg.toFixed(1)} kilograms. Double tap to type a weight.`}
          onPress={startTyping}
          style={[styles.readout, { backgroundColor: withAlpha(tone.brand, 0.07) }]}
        >
          <View style={styles.readoutRow}>
            <Odometer
              value={valueKg.toFixed(1)}
              style={styles.readoutValue}
              label={`${valueKg.toFixed(1)} kilograms`}
            />
            <Text style={[styles.readoutUnit, { color: tone.ink }]}>kg</Text>
          </View>
        </Pressable>
      )}

      <View
        style={[styles.track, { backgroundColor: tone.soft }]}
        onLayout={handleLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Laundry weight"
        accessibilityValue={{
          min: 0,
          max: maxKg,
          now: valueKg,
          text: `${valueKg} kilograms`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          nudge(
            event.nativeEvent.actionName === 'increment' ? WEIGHT_STEP_KG : -WEIGHT_STEP_KG
          )
        }
      >
        {trackWidth > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_SPACING}
            decelerationRate="fast"
            scrollEventThrottle={16}
            // Half the track on each side, so tick 0 can rest under the centre.
            contentContainerStyle={{ paddingHorizontal: trackWidth / 2 }}
            onScrollBeginDrag={beginDrag}
            onScroll={readValue}
            onScrollEndDrag={settle}
            // A flick keeps the ruler moving after the finger lifts; until it
            // stops, the ruler is still the one driving the value.
            onMomentumScrollBegin={beginDrag}
            onMomentumScrollEnd={settle}
          >
            {ticks.map((kg) => {
              const kind = tickKind(kg);
              // Lit by how near the needle it stands, so the strip has a pool
              // of light in it rather than one uniform texture.
              const lit = tickEmphasis(kg, valueKg, LIT_REACH_KG);
              const pale = mixHex(tone.brand, tone.soft, 0.55);
              return (
                <View key={kg} style={styles.tickSlot}>
                  <View
                    style={[
                      styles.tick,
                      {
                        height: TICK_HEIGHTS[kind] + lit * 5,
                        backgroundColor: mixHex(pale, tone.brand, lit),
                        width: kind === 'major' || lit > 0.6 ? 2.5 : 2,
                      },
                    ]}
                  />
                  {kind === 'major' && (
                    <Text
                      style={[
                        styles.tickLabel,
                        lit > 0.25 && { color: tone.ink, fontFamily: type.label.fontFamily },
                      ]}
                    >
                      {kg}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
        {/* The needle. Everything else moves; this stays put. The glow is what
            separates it from the lit ticks it now stands among. */}
        <View pointerEvents="none" style={styles.needleGroup}>
          <View style={[styles.needleCap, { backgroundColor: tone.brand }]} />
          <View
            style={[
              styles.needle,
              { backgroundColor: tone.brand, shadowColor: tone.brand },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Counted things, on a single line you swipe.
 *
 * A grid of every possible count reads as a calculator keypad and takes four
 * rows to ask one small question. One scrolling row keeps the control to a
 * single line, and reuses the same sideways gesture as the weight scale — so
 * the whole screen has one interaction to learn rather than two.
 */
export function PieceCounter({
  value,
  onChange,
  label,
  max = MAX_PIECES,
  compact = false,
  tone = APP_TONE,
}: {
  value: number;
  onChange: (count: number) => void;
  label: string;
  max?: number;
  compact?: boolean;
  tone?: QuantityTone;
}) {
  return (
    <View style={styles.pieceBlock}>
      {/* The count, said once and large, so pieces and kilos answer the same
          question in the same voice rather than one being a row of chips. */}
      <View style={[styles.readout, { backgroundColor: withAlpha(tone.brand, 0.07) }]}>
        <View style={styles.readoutRow}>
          <Odometer
            value={String(value)}
            style={styles.readoutValue}
            label={`${value} ${value === 1 ? 'piece' : 'pieces'}`}
          />
          <Text style={[styles.readoutUnit, { color: tone.ink }]}>
            {value === 1 ? 'piece' : 'pieces'}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {pieceOptions(max).map((count) => (
          <PiecePill
            key={count}
            count={count}
            label={label}
            isSelected={value === count}
            compact={compact}
            tone={tone}
            onPress={() => onChange(clampPieces(count, max))}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * One count, which gives under the finger.
 *
 * A pill that only changes colour on release tells you nothing until the
 * decision is already made. Taking it to 94% on touch-down acknowledges the
 * finger at the moment it lands, which is the difference between a control
 * that responds and a control that reports.
 */
function PiecePill({
  count,
  label,
  isSelected,
  compact,
  tone,
  onPress,
}: {
  count: number;
  label: string;
  isSelected: boolean;
  compact: boolean;
  tone: QuantityTone;
  onPress: () => void;
}) {
  const isReduced = useReducedMotion();
  const [press] = useState(() => new Animated.Value(1));

  const springTo = (toValue: number) => {
    if (isReduced) return;
    Animated.spring(press, {
      toValue,
      damping: 15,
      stiffness: 320,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          count === 0 ? `No ${label}` : `${count} ${count === 1 ? 'piece' : 'pieces'} of ${label}`
        }
        accessibilityState={{ selected: isSelected }}
        onPressIn={() => springTo(0.94)}
        onPressOut={() => springTo(1)}
        onPress={onPress}
        style={[
          styles.pill,
          compact && styles.pillCompact,
          // "None" carries a word, so it needs room a digit does not.
          count === 0 && styles.pillWide,
          isSelected && {
            backgroundColor: tone.brand,
            borderColor: tone.brand,
            shadowColor: tone.brand,
            ...styles.pillSelected,
          },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            compact && styles.pillTextCompact,
            isSelected && styles.pillTextSelected,
          ]}
        >
          {count === 0 ? 'None' : count}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scaleBlock: { gap: space.snug },
  pieceBlock: { gap: space.cosy },

  /** The reading sits *on* something, so it reads as output rather than label. */
  readout: {
    borderRadius: RADII.control,
    paddingVertical: space.cosy,
    paddingHorizontal: space.room,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.tight,
  },
  readoutValue: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: type.hero.fontFamily,
    letterSpacing: -1.4,
    color: colors.text,
  },
  readoutInput: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: type.hero.fontFamily,
    letterSpacing: -1.4,
    color: colors.text,
    minWidth: 96,
    padding: 0,
    margin: 0,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  readoutUnit: { ...type.section, fontSize: 17 },

  track: {
    height: 72,
    borderRadius: RADII.control,
    overflow: 'hidden',
  },
  tickSlot: { width: TICK_SPACING, alignItems: 'center', paddingTop: space.snug },
  tick: { width: 2, borderRadius: 1.5 },
  tickLabel: { ...type.caption, color: colors.subtle, marginTop: 2 },

  /** The fixed mark, and the cap that gives it a head to read against. */
  needleGroup: {
    position: 'absolute',
    left: '50%',
    marginLeft: -5,
    top: 0,
    bottom: 0,
    width: 10,
    alignItems: 'center',
  },
  needleCap: { width: 10, height: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  needle: {
    flex: 1,
    marginTop: 1,
    marginBottom: space.snug,
    width: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },

  // One scrolling line. `paddingRight` leaves the last pill clear of the edge
  // so a partly-visible neighbour signals there is more to swipe.
  pillRow: { flexDirection: 'row', gap: space.snug, paddingRight: space.room },
  pill: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillCompact: { minWidth: 44, height: 44 },
  pillWide: { paddingHorizontal: space.room },
  /** Chosen, and lifted off the row by its own colour rather than only filled. */
  pillSelected: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 10,
    elevation: 4,
  },
  pillText: { fontSize: 18, fontFamily: type.value.fontFamily, color: colors.text },
  pillTextCompact: { fontSize: 17 },
  pillTextSelected: { color: colors.onAccent },
});
