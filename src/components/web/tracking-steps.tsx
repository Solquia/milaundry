/**
 * The path the laundry walks, as a rail rather than a list.
 *
 * Seven statuses stacked vertically took most of the first screen to say
 * something a customer reads in one glance: how far along am I. Laid out
 * horizontally the whole journey fits above the fold, the filled portion *is*
 * the progress bar, and the labels shrink to the marks they always were.
 *
 * The fill grows to the step the order has reached, once, when the page opens.
 * The current step keeps a soft ring around it so the eye lands there before
 * it reads anything.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import type { OrderStatus } from '@/lib/domain/order-status';
import { trackingSteps } from '@/lib/domain/order-tracking';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

interface TrackingStepsProps {
  status: OrderStatus;
  fulfillment: Fulfillment;
  theme: StorefrontTheme;
}

/** One mark per status, in the order they happen. */
const STEP_ICONS: Record<OrderStatus, React.ComponentProps<typeof Ionicons>['name']> = {
  pending: 'receipt-outline',
  received: 'storefront-outline',
  washing: 'water-outline',
  drying: 'sunny-outline',
  folded: 'layers-outline',
  ready: 'checkmark-done-outline',
  completed: 'happy-outline',
  cancelled: 'close-outline',
};

const FILL_MS = 900;
const NODE = 32;

export function TrackingSteps({ status, fulfillment, theme }: TrackingStepsProps) {
  const isReduced = useReducedMotion();
  const steps = trackingSteps(status, fulfillment);
  const [grow] = useState(() => new Animated.Value(isReduced ? 1 : 0));

  const reached = steps.filter((step) => step.state !== 'upcoming').length;
  // The rail runs between the first and last node, so the fill is measured in
  // gaps crossed rather than in steps done.
  const gaps = Math.max(steps.length - 1, 1);
  const share = Math.min(Math.max(reached - 1, 0) / gaps, 1);

  useEffect(() => {
    if (isReduced) {
      grow.setValue(1);
      return;
    }
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration: FILL_MS,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [grow, isReduced, share]);

  if (steps.length === 0) return null;

  // Half a step column at each end, so the line lives between the marks.
  const inset = 50 / steps.length;
  const span = 100 - inset * 2;
  const width = grow.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${share * span}%`],
  });

  return (
    <View style={styles.card} accessibilityRole="list">
      <View style={styles.railRow}>
        {/* The track and its fill sit behind the nodes, inset by half a node at
            each end so the line starts and stops inside the first and last
            mark rather than running off the ends of the rail. */}
        <View
          style={[styles.track, { left: `${inset}%`, right: `${inset}%`, backgroundColor: colors.border }]}
        />
        <Animated.View
          style={[styles.track, { left: `${inset}%`, right: undefined, width, backgroundColor: theme.brand }]}
        />

        {steps.map((step) => {
          const isDone = step.state === 'done';
          const isCurrent = step.state === 'current';
          return (
            <View key={step.status} style={styles.step}>
              <View
                style={[
                  styles.node,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  isDone && { backgroundColor: theme.brand, borderColor: theme.brand },
                  isCurrent && { borderColor: theme.brand, backgroundColor: theme.brandSoft },
                ]}
              >
                <Ionicons
                  name={isDone ? 'checkmark' : STEP_ICONS[step.status]}
                  size={isDone ? 16 : 15}
                  color={isDone ? theme.onBrand : isCurrent ? theme.brandInk : colors.subtle}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  isCurrent && { color: theme.brandInk, fontWeight: '700' },
                  step.state === 'upcoming' && styles.upcoming,
                ]}
                numberOfLines={2}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * No ground of its own. The rail is printed on whatever it is placed on —
   * the order ticket's paper — and boxing it there would put a card inside a
   * card, which is the one arrangement that always reads as unfinished.
   */
  card: { paddingHorizontal: space.tight, paddingBottom: space.tight },
  railRow: { flexDirection: 'row', alignItems: 'flex-start' },
  /**
   * Under the marks, not through them: the nodes draw their own ground and
   * cover the line where they sit. The inset comes from the caller, which is
   * the only thing that knows how many steps this order has.
   */
  track: {
    position: 'absolute',
    top: NODE / 2 - 1.5,
    height: 3,
    borderRadius: 2,
  },
  step: { flex: 1, alignItems: 'center', gap: space.snug },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Small and tight: seven labels share a phone's width, and at body size they
   * would either wrap to three lines each or have to be abbreviated into
   * something nobody says out loud.
   */
  label: {
    ...type.caption,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    color: colors.text,
  },
  upcoming: { color: colors.subtle },
});
