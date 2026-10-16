import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { GLASS_EDGE, GLASS_FILL as GLASS, GLASS_TRAY, PastelWash } from '@/components/glass';
import { tint } from '@/components/laundry-drum';
import { GlyphTile, StageGlyph } from '@/components/stage-glyph';
import { Reveal } from '@/components/reveal';
import { RADII, STATUS_COLORS, colors, formatWhen, space, type } from '@/components/ui-kit';
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
import { fontFor } from '@/lib/domain/design-scale';

/** The elapsed time is shown in minutes, so it only needs a minute's tick. */
const CLOCK_TICK_MS = 60_000;
/** How long "Just updated" stays up after the shop moves the order. */
const FLASH_MS = 5000;
const NODE = 28;
const NODE_CURRENT = 34;
/** The selection ring's gap around a tile. */
const RING_PAD = 2;

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
  const lastIndex = journey.stops.length - 1;
  const progress = journey.isFinished
    ? 1
    : journey.currentIndex >= 0 && lastIndex > 0
      ? journey.currentIndex / lastIndex
      : 0;

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        <PastelWash color={color} />
        <View style={styles.topRow}>
          {isLive ? <LivePill color={color} isJustUpdated={isJustUpdated} /> : <View />}
          <Text style={[styles.standing, { color }]}>{journey.standing}</Text>
        </View>

        <StageGlyph
          status={order.status}
          icon={journey.isCancelled ? 'close-circle-outline' : (liveStop?.icon ?? 'shirt')}
          color={color}
          progress={progress}
          size={132}
        />

        <View style={styles.words} accessibilityLiveRegion="polite">
          <Text style={styles.headline} accessibilityRole="header">
            {journey.headline}
          </Text>
          <SinceLine journey={journey} now={now} />
        </View>

        {journey.nextUp ? (
          <View style={styles.nextChip}>
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
 * The road, as a row of app-icon tiles over an iOS segmented bar: steps done
 * and the live one in colour, what is ahead frosted white. Colour is never the
 * only cue — the live tile is larger and lifted, and done steps carry a check.
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
  // Finished orders fill the whole road; otherwise up to the live stop.
  const reached = currentIndex >= 0 ? currentIndex : stops.length - 1;

  return (
    <View style={styles.railWrap}>
      <View style={styles.rail}>
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
      <View style={styles.segments}>
        {stops.map((stop, index) => (
          <View
            key={stop.status}
            style={[styles.segment, index <= reached && { backgroundColor: color }]}
          />
        ))}
      </View>
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
        <View style={[styles.nodeRing, isSelected && { borderColor: tint(color, 0.35) }]}>
          <GlyphTile
            icon={isDone ? 'checkmark-outline' : stop.icon}
            color={color}
            size={size}
            isMuted={!isDone && !isCurrent}
            isLifted={isCurrent}
          />
        </View>
      </View>
    </Pressable>
  );
}

/** The selected stop, set like an iOS notification: icon tile, title, time. */
function StopDetail({ stop, color }: { stop: JourneyStop; color: string }) {
  const when = stop.reachedAt ? formatWhen(stop.reachedAt) : '';
  let status = 'Coming up';
  if (stop.state === 'current') status = 'Happening now';
  else if (stop.state === 'done') status = when ? `Done · ${when}` : 'Done';

  return (
    <View style={styles.detail}>
      <GlyphTile
        icon={stop.icon}
        color={color}
        size={42}
        isMuted={stop.state === 'upcoming'}
        isLifted={false}
      />
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

const SHELL_RADIUS = 34;
const SHELL_INSET = 8;

const styles = StyleSheet.create({
  /** The frosted tray the glass sits in, like the Wallet card's outer frame. */
  shell: {
    padding: SHELL_INSET,
    gap: SHELL_INSET,
    borderRadius: SHELL_RADIUS,
    borderCurve: 'continuous',
    backgroundColor: GLASS_TRAY,
    borderWidth: 1.5,
    borderColor: GLASS_EDGE,
    shadowColor: '#1B2559',
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  stage: {
    alignItems: 'center',
    gap: space.room,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.section,
    borderRadius: SHELL_RADIUS - SHELL_INSET,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    overflow: 'hidden',
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standing: { ...type.label, fontSize: 15 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.snug + 2,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  liveDotBox: { width: 8, height: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveHalo: { position: 'absolute' },
  liveText: { ...type.caption, ...fontFor(600), color: colors.text },
  words: { alignItems: 'center', gap: space.tight },
  headline: { ...type.title, color: colors.text, textAlign: 'center' },
  since: { ...type.body, fontSize: 15, lineHeight: 20, color: colors.subtle, textAlign: 'center' },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.cosy,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  nextLabel: { ...type.caption, color: colors.subtle },
  nextValue: { ...type.label },
  road: { paddingHorizontal: space.cosy, paddingTop: space.snug, paddingBottom: space.tight, gap: space.cosy },
  railWrap: { gap: space.snug },
  rail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // iOS segmented progress: one capsule per stop.
  segments: { flexDirection: 'row', gap: 4, paddingHorizontal: 2 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120, 128, 160, 0.16)',
  },
  // Every slot is as wide as the live tile plus its ring, so the row lines up.
  nodeSlot: { width: NODE_CURRENT + RING_PAD * 2 + 3, alignItems: 'center' },
  nodePressed: { transform: [{ scale: 0.92 }] },
  nodeBox: { height: NODE_CURRENT + RING_PAD * 2 + 3, alignItems: 'center', justifyContent: 'center' },
  // The tile the panel is describing gets a soft ring, like a focused icon.
  nodeRing: {
    padding: RING_PAD,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.snug,
    paddingRight: space.room,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  detailWords: { flex: 1, gap: 2 },
  detailHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.snug,
  },
  detailLabel: { ...type.body, fontSize: 15, lineHeight: 20, ...fontFor(600), color: colors.text },
  detailState: { ...type.caption, color: colors.subtle },
  detailBlurb: { ...type.caption, color: colors.subtle },
});
