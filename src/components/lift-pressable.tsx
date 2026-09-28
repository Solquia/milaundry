/**
 * A Pressable that lifts: the home page's one piece of motion.
 *
 * Under a pointer, or under a thumb while it is held down, the card rises a
 * few points and settles back when let go — the same answer from every card
 * on the page, so the whole sheet feels like one set of objects rather than a
 * mix of rows that dim and rows that do nothing. Under Reduce Motion it is a
 * plain Pressable.
 *
 * The rise lives on a wrapper rather than on the Pressable's own style so a
 * caller's `style` — including the `({ pressed }) => …` form — passes through
 * untouched.
 */
import React, { useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type MouseEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReducedMotion } from '@/lib/use-reduced-motion';

/** How far a card rises, in points. */
const LIFT = 5;
// The native driver is not available on the web; there it would only warn.
const USE_NATIVE = Platform.OS !== 'web';

interface LiftPressableProps extends PressableProps {
  /** Layout for the wrapper that moves — margins, flex, width. */
  outerStyle?: StyleProp<ViewStyle>;
}

export function LiftPressable({
  outerStyle,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...props
}: LiftPressableProps) {
  const isReduced = useReducedMotion();
  const [lift] = useState(() => new Animated.Value(0));

  const to = (value: number) => {
    if (isReduced) return;
    Animated.spring(lift, {
      toValue: value,
      speed: 20,
      bounciness: value === 1 ? 8 : 4,
      useNativeDriver: USE_NATIVE,
    }).start();
  };

  const motion = {
    transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] }) }],
  };

  return (
    <Animated.View style={[outerStyle, motion]}>
      <Pressable
        {...props}
        onHoverIn={(event: MouseEvent) => {
          to(1);
          onHoverIn?.(event);
        }}
        onHoverOut={(event: MouseEvent) => {
          to(0);
          onHoverOut?.(event);
        }}
        onPressIn={(event: GestureResponderEvent) => {
          to(1);
          onPressIn?.(event);
        }}
        onPressOut={(event: GestureResponderEvent) => {
          to(0);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
