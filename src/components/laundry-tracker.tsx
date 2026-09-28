import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { LaundryDrum, tint } from '@/components/laundry-drum';
import { Reveal } from '@/components/reveal';
import { RADII, STATUS_COLORS, colors, elevation, formatWhen, space, type } from '@/components/ui-kit';
import {
  elapsedLabel,
  laundryJourney,
  type JourneyStop,
  type LaundryJourney,
} from '@/lib/domain/laundry-journey';
import type { OrderStatus } from '@/lib/domain/order-status';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import { useHaptic } from '@/lib/use-app-settings';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** The elapsed time is shown in minutes, so it only needs a minute's tick. */
const CLOCK_TICK_MS = 60_000;
/** How long "Just updated" stays up after the shop moves the order. */
const FLASH_MS = 5000;
const NODE = 30;
const NODE_CURRENT = 40;

interface TrackerOrder {
  status: OrderStatus;
  fulfillment: Fulfillment;
  created_at: string;
}

interface TrackerHistoryEntry {
  to_status: OrderStatus;
  created_at: string;
}

/** Finished work reads as success, not as the ramp's grey. */
function stageColor(status: OrderStatus): string {
  return status === 'completed' ? colors.success : STATUS_COLORS[status];
}

/**
 * Where the laundry is, as the first thing on the order screen.
 *
 * Three answers, in the order a customer asks them: *what is happening* (the
 * drum and the headline — readable at a glance), *how long* (since when, and
 * for how long), and *what next*. Below that, the whole road as a rail; any
 * stop can be tapped to see when it happened or what happens there. When the
 * shop moves the order while the screen is open, the card says so — a buzz
 * and a "Just updated" — instead of silently swapping a word.
 */
export function LaundryTracker({
  order,
  history,
}: {
  order: TrackerOrder;
  history: readonly TrackerHistoryEntry[];
}) {
  const journey = laundryJourney(order, history);
  const color = stageColor(order.status);
  const now = useMinuteClock();
  const isJustUpdated = useStatusFlash(order.status);

  // A tap pins a stop until the order moves on; then the live stop leads again.
  const [pinned, setPinned] = useState<{ stop: OrderStatus; during: OrderStatus } | null>(null);
  const liveStop = journey.current ?? journey.stops[journey.stops.length - 1] ?? null;
  const pinnedStop =
    pinned?.during === order.status
      ? journey.stops.find((stop) => stop.status === pinned.stop)
      : undefined;
  const selected = pinnedStop ?? liveStop;

  const isLive = !journey.isFinished && !journey.isCancelled;

  return (
    <View style={[styles.card, elevation.hero]}>
      <View style={[styles.stage, { backgroundColor: tint(color, 0.1) }]}>
        <View style={styles.topRow}>
          {isLive ? <LivePill color={color} isJustUpdated={isJustUpdated} /> : <View />}
          <Text style={[styles.standing, { color }]}>{journey.standing}</Text>
        </View>

        <LaundryDrum
          status={order.status}
          icon={journey.isCancelled ? 'close-circle-outline' : (liveStop?.icon ?? 'shirt')}
          color={color}
        />

        <View style={styles.words} accessibilityLiveRegion="polite">
          <Text style={styles.headline} accessibilityRole="header">
            {journey.headline}
          </Text>
          <SinceLine journey={journey} now={now} />
        </View>

        {journey.nextUp ? (
          <View style={[styles.nextChip, { borderColor: tint(color, 0.35) }]}>
            <Text style={styles.nextLabel}>Up next</Text>
            <Ionicons name="arrow-forward" size={14} color={color} />
            <Text style={[styles.nextValue, { color }]}>{journey.nextUp}</Text>
          </View>
        ) : null}
      </View>

      {journey.stops.length > 0 && selected ? (
        <View style={styles.road}>
          <Rail
            stops={journey.stops}
            currentIndex={journey.currentIndex}
            selected={selected.status}
            color={color}
            onSelect={(stop) => setPinned({ stop, during: order.status })}
          />
          <Reveal key={`${selected.status}-${order.status}`}>
            <StopDetail stop={selected} color={color} />
          </Reveal>
        </View>
      ) : null}
    </View>
  );
}

function SinceLine({ journey, now }: { journey: LaundryJourney; now: number }) {
  const when = journey.since ? formatWhen(journey.since) : '';
  if (!when) return null;

  if (journey.isFinished || journey.isCancelled) {
    return <Text style={styles.since}>{when}</Text>;
  }
  const elapsed = elapsedLabel(journey.since, now);
  const lead = elapsed === 'just now' ? 'Just now' : elapsed ? `${elapsed} so far` : '';
  return <Text style={styles.since}>{lead ? `${lead} · since ${when}` : `Since ${when}`}</Text>;
}

/** A green-dot "Live", which turns into "Just updated" when the shop acts. */
function LivePill({ color, isJustUpdated }: { color: string; isJustUpdated: boolean }) {
  const isReduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  const dotColor = isJustUpdated ? colors.onAccent : colors.success;

  useEffect(() => {
    if (isReduced) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isReduced, pulse]);

  return (
    <View
      style={[styles.livePill, isJustUpdated && { backgroundColor: color }]}
      accessibilityLabel={isJustUpdated ? 'Just updated by the shop' : 'Live updates on'}
    >
      <View style={styles.liveDotBox}>
        <Animated.View
          style={[
            styles.liveDot,
            styles.liveHalo,
            {
              backgroundColor: dotColor,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
            },
          ]}
        />
        <View style={[styles.liveDot, { backgroundColor: dotColor }]} />
      </View>
      <Text style={[styles.liveText, isJustUpdated && { color: colors.onAccent }]}>
        {isJustUpdated ? 'Just updated' : 'Live'}
      </Text>
    </View>
  );
}

/**
 * The road: one node per stop, joined by a track that fills up to where the
 * laundry is. The travelled part takes the stage colour, what is ahead stays
 * grey, and the live node is larger and lifted — colour is never the only cue.
 */
function Rail({
  stops,
  currentIndex,
  selected,
  color,
  onSelect,
}: {
  stops: JourneyStop[];
  currentIndex: number;
  selected: OrderStatus;
  color: string;
  onSelect: (stop: OrderStatus) => void;
}) {
  const haptic = useHaptic();
  const isReduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const [fill] = useState(() => new Animated.Value(0));

  // Finished orders fill the whole road; otherwise up to the live node.
  const reached = currentIndex >= 0 ? currentIndex : stops.length - 1;
  const fraction = stops.length > 1 ? reached / (stops.length - 1) : 0;

  useEffect(() => {
    if (isReduced) {
      fill.setValue(fraction);
      return;
    }
    Animated.timing(fill, {
      toValue: fraction,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      // Width cannot run on the native thread.
      useNativeDriver: false,
    }).start();
  }, [fraction, fill, isReduced]);

  return (
    <View style={styles.rail}>
      <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <Animated.View
          style={[
            styles.trackFill,
            {
              backgroundColor: color,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: [0, trackWidth] }),
            },
          ]}
        />
      </View>

      {stops.map((stop) => (
        <RailNode
          key={stop.status}
          stop={stop}
          color={color}
          isSelected={stop.status === selected}
          onPress={() => {
            haptic('select');
            onSelect(stop.status);
          }}
        />
      ))}
    </View>
  );
}

function RailNode({
  stop,
  color,
  isSelected,
  onPress,
}: {
  stop: JourneyStop;
  color: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const isCurrent = stop.state === 'current';
  const isDone = stop.state === 'done';
  const size = isCurrent ? NODE_CURRENT : NODE;
  const stateWord = isCurrent ? 'happening now' : isDone ? 'done' : 'coming up';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${stop.label}, ${stateWord}`}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [styles.nodeSlot, pressed && styles.nodePressed]}
    >
      <View style={styles.nodeBox}>
        <View
          style={[
            styles.node,
            { width: size, height: size, borderRadius: size / 2 },
            isDone && { backgroundColor: color, borderColor: color },
            isCurrent && [{ backgroundColor: color, borderColor: colors.card }, elevation.lift],
            isSelected && !isCurrent && { borderColor: color },
          ]}
        >
          <Ionicons
            name={(isDone ? 'checkmark' : stop.icon) as never}
            size={isCurrent ? 20 : 15}
            color={isDone || isCurrent ? colors.onAccent : colors.subtle}
          />
        </View>
      </View>
      {/* The caret under the stop the panel is describing. */}
      <View style={[styles.caret, isSelected && { backgroundColor: color }]} />
    </Pressable>
  );
}

function StopDetail({ stop, color }: { stop: JourneyStop; color: string }) {
  const when = stop.reachedAt ? formatWhen(stop.reachedAt) : '';
  let status = 'Coming up';
  if (stop.state === 'current') status = 'Happening now';
  else if (stop.state === 'done') status = when ? `Done · ${when}` : 'Done';

  return (
    <View style={[styles.detail, { backgroundColor: tint(color, 0.06) }]}>
      <View style={[styles.detailIcon, { backgroundColor: tint(color, 0.16) }]}>
        <Ionicons name={stop.icon as never} size={20} color={color} />
      </View>
      <View style={styles.detailWords}>
        <View style={styles.detailHead}>
          <Text style={styles.detailLabel}>{stop.label}</Text>
          <Text style={[styles.detailState, stop.state !== 'upcoming' && { color }]}>{status}</Text>
        </View>
        <Text style={styles.detailBlurb}>{stop.blurb}</Text>
      </View>
    </View>
  );
}

/** Wall-clock time, refreshed each minute, for the "25 min so far" line. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * True for a few seconds after the status changes under an open screen, with
 * a success buzz. Never on first render: arriving is not an update.
 */
function useStatusFlash(status: OrderStatus): boolean {
  const haptic = useHaptic();
  const previous = useRef(status);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (previous.current === status) return;
    previous.current = status;
    haptic('success');
    setIsFlashing(true);
    const id = setTimeout(() => setIsFlashing(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [status, haptic]);

  return isFlashing;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: RADII.sheet,
    overflow: 'hidden',
  },
  stage: {
    alignItems: 'center',
    gap: space.room,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.section,
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standing: { ...type.label },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.snug + 2,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
  },
  liveDotBox: { width: 8, height: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveHalo: { position: 'absolute' },
  liveText: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.text },
  words: { alignItems: 'center', gap: space.tight },
  headline: { ...type.title, color: colors.text, textAlign: 'center' },
  since: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.cosy,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  nextLabel: { ...type.caption, color: colors.subtle },
  nextValue: { ...type.label },
  road: { padding: space.room, gap: space.cosy },
  rail: { flexDirection: 'row', justifyContent: 'space-between' },
  // Runs centre-of-first-node to centre-of-last-node, behind the nodes.
  track: {
    position: 'absolute',
    left: NODE_CURRENT / 2,
    right: NODE_CURRENT / 2,
    top: NODE_CURRENT / 2 - 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: { height: 4, borderRadius: 2 },
  // Every slot is as wide as the live node so the track's ends line up.
  nodeSlot: { width: NODE_CURRENT, alignItems: 'center', gap: 6 },
  nodePressed: { transform: [{ scale: 0.92 }] },
  nodeBox: { height: NODE_CURRENT, alignItems: 'center', justifyContent: 'center' },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  caret: { width: 14, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  detail: {
    flexDirection: 'row',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: RADII.control,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailWords: { flex: 1, gap: 2 },
  detailHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.snug,
  },
  detailLabel: { ...type.label, color: colors.text },
  detailState: { ...type.caption, color: colors.subtle },
  detailBlurb: { ...type.caption, color: colors.subtle },
});
