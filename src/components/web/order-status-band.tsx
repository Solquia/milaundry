/**
 * Where your laundry is, at the top of the shop's own page.
 *
 * The price list answers "what does this cost". A customer who has already
 * ordered is not back for that — they are back to find out whether the wash is
 * done, and before this band the only route to that answer was a text link
 * below the prices reading "Your orders here". So the answer comes first now,
 * above the grid, in the shape of the thing a laundry actually hands you: a
 * claim ticket. The docket number set large, the stage in words beside it, and
 * the whole path underneath as a rail that fills to where the load has got to.
 *
 * It keeps its shape in every state. No order, not signed in, order finished —
 * the band is the same block in the same place, so the page does not reflow
 * around a customer's history and a returning guest always has somewhere to
 * press. The rule for *which* order it speaks for is `domain/storefront-order`.
 */
import React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFor, space, type } from '@/components/ui-kit';
import { docketNumber } from '@/lib/domain/docket';
import type { OrderStatus } from '@/lib/domain/order-status';
import { trackingHeadline, trackingSteps } from '@/lib/domain/order-tracking';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** The dot on the step the laundry is at, and the halo that breathes around it. */
const DOT = 11;
const HALO = 26;
const BREATH_MS = 1900;

interface OrderStatusBandProps {
  theme: StorefrontTheme;
  /** The order this band speaks for. Absent is the empty state, not an error. */
  order: { id: string; status: OrderStatus; fulfillment: Fulfillment } | null;
  /** True while the customer's orders are still being fetched. */
  isLoading?: boolean;
  /** False for a visitor we cannot look an order up for. */
  isSignedIn: boolean;
  /** Opens the order, or the page that finds it. */
  onOpen: () => void;
}

export function OrderStatusBand({
  theme,
  order,
  isLoading = false,
  isSignedIn,
  onOpen,
}: OrderStatusBandProps) {
  if (isLoading) return <BandShell theme={theme} isQuiet />;
  if (!order) {
    return (
      <EmptyBand
        theme={theme}
        onOpen={onOpen}
        title={isSignedIn ? 'No order here yet' : 'Track an order'}
        body={
          isSignedIn
            ? 'Book below and this is where you will watch it move.'
            : 'Enter the name and number you booked with.'
        }
      />
    );
  }
  return <LiveBand theme={theme} order={order} onOpen={onOpen} />;
}

/**
 * The band with a laundry in it.
 *
 * The rail is drawn from the same `trackingSteps` the full tracking page uses,
 * so the two can never disagree about where an order is. Seven statuses is too
 * many labels to set across a phone, though, so only the current step is
 * named — the rest are marks, and the headline carries the meaning.
 */
function LiveBand({
  theme,
  order,
  onOpen,
}: {
  theme: StorefrontTheme;
  order: { id: string; status: OrderStatus; fulfillment: Fulfillment };
  onOpen: () => void;
}) {
  const isReduced = useReducedMotion();
  const steps = trackingSteps(order.status, order.fulfillment);
  const done = steps.filter((step) => step.state === 'done').length;
  const current = steps.findIndex((step) => step.state === 'current');
  const isFinished = current === -1;
  // The fill reaches the live dot, or the whole way for a collected order.
  const reached = isFinished ? steps.length - 1 : current;
  const progress = steps.length > 1 ? reached / (steps.length - 1) : 1;

  const [fill] = React.useState(() => new Animated.Value(0));
  const [breath] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (isReduced) {
      fill.setValue(1);
      breath.setValue(0);
      return;
    }
    const sweep = Animated.timing(fill, {
      toValue: 1,
      duration: 950,
      delay: 160,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    });
    sweep.start();
    // Only a live order breathes. A collected one is finished, and a pulse on
    // it would say the shop is still working.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    if (!isFinished) pulse.start();
    return () => {
      sweep.stop();
      pulse.stop();
    };
  }, [fill, breath, isReduced, isFinished, order.id]);

  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.round(progress * 100)}%`],
  });

  return (
    <BandShell theme={theme} onOpen={onOpen} label={`${trackingHeadline(order.status, order.fulfillment)}. Open this order.`}>
      <View style={styles.head}>
        <View style={styles.headWords}>
          <Text style={[styles.docket, { color: theme.brandInk }]} numberOfLines={1}>
            No. {docketNumber(order.id)}
          </Text>
          <Text style={styles.headline} numberOfLines={2}>
            {trackingHeadline(order.status, order.fulfillment)}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: theme.brandInk }]}>›</Text>
      </View>

      <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.track} />
        <Animated.View style={[styles.trackFill, { width, backgroundColor: theme.brand }]} />
        <View style={styles.marks}>
          {steps.map((step, index) => {
            const isPast = index <= reached;
            const isHere = !isFinished && index === current;
            return (
              <View key={step.status} style={styles.markSlot}>
                {isHere && !isReduced ? (
                  <Animated.View
                    style={[
                      styles.halo,
                      {
                        backgroundColor: theme.brand,
                        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0] }),
                        transform: [
                          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                        ],
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.mark,
                    isPast && { backgroundColor: theme.brand, borderColor: theme.brand },
                    isHere && styles.markHere,
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={[styles.stage, { color: theme.brandInk }]} numberOfLines={1}>
          {isFinished ? steps[steps.length - 1]?.label : steps[current]?.label}
        </Text>
        <Text style={styles.count}>
          {isFinished ? 'All done' : `Step ${done + 1} of ${steps.length}`}
        </Text>
      </View>
    </BandShell>
  );
}

/**
 * The band with nothing in it.
 *
 * Same block, same place, same height as far as it can be — a hairline dashed
 * edge instead of a filled one. An empty state that collapses would make the
 * page jump the moment a customer's first order lands, and would leave a guest
 * who closed the tab with no way back to their laundry from here.
 */
function EmptyBand({
  theme,
  title,
  body,
  onOpen,
}: {
  theme: StorefrontTheme;
  title: string;
  body: string;
  onOpen: () => void;
}) {
  return (
    <BandShell theme={theme} onOpen={onOpen} isEmpty label={`${title}. ${body}`}>
      <View style={styles.head}>
        <View style={styles.headWords}>
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptyBody}>{body}</Text>
        </View>
        <Text style={[styles.chevron, { color: theme.brandInk }]}>›</Text>
      </View>
      {/* The rail is still drawn, unlit. It is the shape the band takes once
          there is something to track, and showing it empty is what makes the
          filled version legible the first time a customer sees it. */}
      <View style={styles.railEmpty} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.track} />
        <View style={styles.marks}>
          {[0, 1, 2, 3, 4, 5, 6].map((mark) => (
            <View key={mark} style={styles.markSlot}>
              <View style={styles.mark} />
            </View>
          ))}
        </View>
      </View>
    </BandShell>
  );
}

/** The ticket itself: the one shape every state of this band wears. */
function BandShell({
  theme,
  children,
  onOpen,
  isEmpty = false,
  isQuiet = false,
  label,
}: {
  theme: StorefrontTheme;
  children?: React.ReactNode;
  onOpen?: () => void;
  isEmpty?: boolean;
  isQuiet?: boolean;
  label?: string;
}) {
  const skin = [
    styles.band,
    isEmpty
      ? { borderColor: colors.border, borderStyle: 'dashed' as const }
      : { backgroundColor: theme.brandSoft, borderColor: theme.brandSoft },
    isQuiet && styles.bandQuiet,
  ];
  if (!onOpen) return <View style={skin}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onOpen}
      style={({ pressed, hovered }) => [
        ...skin,
        hovered && styles.bandHovered,
        pressed && styles.bandPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy + 2,
    gap: space.cosy,
  },
  bandQuiet: { opacity: 0.5, minHeight: 132 },
  bandHovered: { transform: [{ translateY: -2 }] },
  bandPressed: { opacity: 0.85 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  headWords: { flex: 1, minWidth: 0, gap: 2 },
  /**
   * The number the shop would write on a paper slip, set like one: small,
   * spaced out, and in the shop's own ink rather than in body grey.
   */
  docket: {
    fontFamily: fontFor(700),
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headline: { ...type.section, color: colors.text, fontSize: 17, lineHeight: 22 },
  chevron: { fontSize: 26, lineHeight: 26, fontFamily: fontFor(600), marginTop: 2 },

  /** The path, as one line the fill runs along and the marks sit on. */
  rail: { height: DOT, justifyContent: 'center' },
  railEmpty: { height: DOT, justifyContent: 'center', opacity: 0.55 },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  trackFill: { position: 'absolute', left: 0, height: 3, borderRadius: 2 },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
  markSlot: { alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  /** The live one is a ring, not a filled dot: it is open, still happening. */
  markHere: { backgroundColor: colors.card, transform: [{ scale: 1.25 }] },
  /** The breath. Behind the dot, never touched by a press. */
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },

  legend: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.snug },
  stage: { ...type.label, fontSize: 13, flexShrink: 1 },
  count: { ...type.caption, color: colors.subtle },

  emptyTitle: { ...type.section, color: colors.text, fontSize: 16 },
  emptyBody: { ...type.caption, color: colors.subtle, lineHeight: 18 },
});
