import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/use-reduced-motion';

/** Cap on the whole sequence. Past this a list feels like it is loading slowly. */
export const REVEAL_STAGGER_MS = 55;
export const REVEAL_MAX_DELAY_MS = 220;

/**
 * A short arrival for something that has just become available.
 *
 * Used on siblings that genuinely appear as a list, so the stagger says "these
 * came together and there are several" — not as a scroll reveal on every
 * section, which turns a page into a slideshow.
 *
 * Rises 10pt and fades over 340ms on an exponential ease-out. It **settles
 * fully visible**, and starts settled when the device asks for less motion, so
 * nothing here is ever required to read the screen.
 */
export function Reveal({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const isReduced = useReducedMotion();
  // Lazy state, not a ref: the driver is read during render to build the
  // transform, and reading a ref there is a hook-rules violation.
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      enter.setValue(1);
      return;
    }

    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      delay: Math.min(delay, REVEAL_MAX_DELAY_MS),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [delay, enter, isReduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
