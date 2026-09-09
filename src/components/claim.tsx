import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { claimRingDelays, type ConnectionRank } from '@/lib/domain/connection-welcome';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The claim: what a laundry does the instant it becomes yours.
 *
 * The shopfront already knows how to *arrive* — `entrance.tsx` runs that, once,
 * on open. This is a different moment and needed its own gesture: not a screen
 * appearing, but a thing changing owner while the customer watches.
 *
 * It is the app's own language rather than a stock celebration. The shop's mark
 * floods with the accent it will wear on the home screen from now on, swells as
 * it takes the colour, and pushes rings of water out from under itself — the
 * same ring the hero already uses on arrival, now leaving the mark because
 * something happened rather than because the screen opened. No confetti: a
 * laundry app that throws paper has borrowed someone else's idea of joy.
 *
 * Amplitude is the only thing that changes between a first laundry and a fifth.
 * `claimRingDelays` decides how many rings; everything else is identical, so the
 * fifth connection feels like the first one's quieter sibling and not like a
 * different product.
 */

/** The whole gesture, start to settled. */
const CLAIM_MS = 1000;
/** How long one ring takes to travel out and fade. */
const RING_MS = 620;
/** How long the mark takes to take its colour. */
const FILL_MS = 420;

/** Sampled easing, so every cue stays on the native driver. See `entrance.tsx`. */
const CURVE_SAMPLES = 16;

function easedRange(
  start: number,
  end: number,
  easing: (value: number) => number,
  from: number,
  to: number
): { inputRange: number[]; outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const t = i / CURVE_SAMPLES;
    inputRange.push(start + (end - start) * t);
    outputRange.push(from + (to - from) * easing(t));
  }
  return { inputRange, outputRange };
}

/**
 * The driver for one claim, started the moment the connection lands.
 *
 * It stays at rest until then, so a shop you joined last month opens with its
 * mark already coloured and nothing moving. With Reduce Motion on it jumps
 * straight to settled: the mark is simply the shop's colour, and the rings —
 * which are decoration and carry nothing a customer needs — never appear.
 *
 * `startDelay` exists for the one case where the claim did not happen on this
 * screen: connecting from the shops directory navigates here, so the gesture
 * would otherwise run on top of the shopfront's own entrance and the mark would
 * be swelling before it had finished landing. Held back until the mark is down,
 * the two read as one sequence — the shop arrives, then it becomes yours.
 */
export function useClaim(
  isClaimed: boolean,
  startDelay = 0
): {
  claim: Animated.Value;
  isReduced: boolean;
} {
  const isReduced = useReducedMotion();
  // Lazy state, not a ref: the driver is read during render to build the
  // transforms, and reading a ref there is a hook-rules violation.
  const [claim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isClaimed) return;

    if (isReduced) {
      claim.setValue(1);
      return;
    }

    claim.setValue(0);
    const timing = Animated.timing(claim, {
      toValue: 1,
      duration: CLAIM_MS,
      // Linear: the curves live in each cue, so one driver can carry cues that
      // ease differently without fighting each other.
      easing: Easing.linear,
      useNativeDriver: true,
    });
    // `Animated.delay` throws on a negative duration on some drivers.
    const run =
      startDelay > 0
        ? Animated.sequence([Animated.delay(startDelay), timing])
        : timing;
    run.start();

    return () => run.stop();
  }, [isClaimed, isReduced, startDelay, claim]);

  return { claim, isReduced };
}

/**
 * How much of the shop's own colour the mark is wearing, 0 → 1.
 *
 * Painted as an overlay above the neutral fill rather than as a colour swap, so
 * the change is a wash arriving over the mark instead of a repaint between two
 * frames.
 */
export function claimFill(
  claim: Animated.Value
): Animated.AnimatedInterpolation<number> {
  return claim.interpolate({
    ...easedRange(0, FILL_MS / CLAIM_MS, Easing.out(Easing.cubic), 0, 1),
    extrapolate: 'clamp',
  });
}

/**
 * The mark's swell as it takes the colour.
 *
 * It grows a little and comes back — the give a machine door has when it
 * accepts a load. It ends at exactly 1, so the mark is never left resized.
 */
export function claimSwell(
  claim: Animated.Value
): Animated.AnimatedInterpolation<number> {
  return claim.interpolate({
    inputRange: [0, 0.16, 0.46, 1],
    outputRange: [1, 1.12, 1, 1],
    extrapolate: 'clamp',
  });
}

/**
 * Rings of water leaving the mark.
 *
 * Purely decorative: `pointerEvents="none"` and out of the accessibility tree
 * entirely, so they can never intercept a tap or make a screen reader announce
 * a shape. The words that carry this moment are in the welcome note, which is a
 * live region; the rings are what the moment looks like, not what it says.
 */
export function ClaimRings({
  claim,
  rank,
  color,
  size,
}: {
  claim: Animated.Value;
  rank: ConnectionRank;
  color: string;
  size: number;
}) {
  const delays = claimRingDelays(rank);

  return (
    <>
      {delays.map((delay) => {
        const start = delay / CLAIM_MS;
        const end = Math.min(1, (delay + RING_MS) / CLAIM_MS);

        const spread = claim.interpolate({
          ...easedRange(start, end, Easing.out(Easing.cubic), 1, 2.6),
          extrapolate: 'clamp',
        });

        // Present at once, gone by the end of its own travel: a ring parked at
        // full spread would read as a border the shop had grown.
        const fade = claim.interpolate({
          inputRange: [start, start + (end - start) * 0.12, end],
          outputRange: [0.55, 0.5, 0],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={delay}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: color,
                opacity: fade,
                transform: [{ scale: spread }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2 },
});
