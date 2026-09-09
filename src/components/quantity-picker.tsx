import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MAX_WEIGHT_KG, WEIGHT_STEP_KG } from '@/lib/domain/booking-estimate';
import {
  MAX_PIECES,
  TICK_SPACING,
  clampPieces,
  offsetForWeight,
  pieceOptions,
  rulerTicks,
  tickKind,
  weightForOffset,
} from '@/lib/domain/quantity-input';

import { colors, space, type } from './ui-kit';

const TICK_HEIGHTS = { major: 26, minor: 17, micro: 10 } as const;

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
}: {
  valueKg: number;
  onChange: (kg: number) => void;
  maxKg?: number;
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
      <View style={styles.readoutRow}>
        <Text style={styles.readoutValue}>{valueKg.toFixed(1)}</Text>
        <Text style={styles.readoutUnit}>kg</Text>
      </View>

      <View
        style={styles.track}
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
              return (
                <View key={kg} style={styles.tickSlot}>
                  <View
                    style={[
                      styles.tick,
                      { height: TICK_HEIGHTS[kind] },
                      kind === 'major' && styles.tickMajor,
                    ]}
                  />
                  {kind === 'major' && <Text style={styles.tickLabel}>{kg}</Text>}
                </View>
              );
            })}
          </ScrollView>
        )}
        {/* The needle. Everything else moves; this stays put. */}
        <View pointerEvents="none" style={styles.needle} />
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
}: {
  value: number;
  onChange: (count: number) => void;
  label: string;
  max?: number;
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillRow}
    >
      {pieceOptions(max).map((count) => {
        const isSelected = value === count;
        return (
          <Pressable
            key={count}
            accessibilityRole="button"
            accessibilityLabel={
              count === 0
                ? `No ${label}`
                : `${count} ${count === 1 ? 'piece' : 'pieces'} of ${label}`
            }
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(clampPieces(count, max))}
            style={[
              styles.pill,
              compact && styles.pillCompact,
              // "None" carries a word, so it needs room a digit does not.
              count === 0 && styles.pillWide,
              isSelected && styles.pillSelected,
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
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scaleBlock: { gap: space.snug },

  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.tight,
  },
  readoutValue: { fontSize: 40, fontWeight: '700', letterSpacing: -0.8, color: colors.text },
  readoutUnit: { fontSize: 18, fontWeight: '600', color: colors.subtle },

  track: {
    height: 64,
    backgroundColor: colors.actionSurface,
    borderRadius: space.cosy,
    overflow: 'hidden',
  },
  tickSlot: { width: TICK_SPACING, alignItems: 'center', paddingTop: space.snug },
  tick: { width: 2, borderRadius: 1, backgroundColor: colors.actionMuted },
  tickMajor: { backgroundColor: colors.action, width: 2 },
  tickLabel: { ...type.caption, fontWeight: '600', color: colors.subtle, marginTop: 2 },

  needle: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1.5,
    top: space.snug,
    bottom: space.snug,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.action,
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
  // `action`, not the identity blue: this pill carries a white numeral.
  pillSelected: { backgroundColor: colors.action, borderColor: colors.action },
  pillText: { fontSize: 18, fontWeight: '700', color: colors.text },
  pillTextCompact: { fontSize: 17 },
  pillTextSelected: { color: colors.onAccent },
});
