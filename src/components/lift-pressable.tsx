/**
 * A Pressable that answers the way an iOS card does.
 *
 * Under a thumb the card gives a little — it settles to 97% and springs back
 * when let go, the press App Store and Wallet cards make. Under a pointer on
 * the web it rises a few points instead, since a hover is an invitation, not
 * a press. The same answer from every card, so the page feels like one set of
 * objects. Under Reduce Motion it is a plain Pressable.
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

/** How far a card rises under a pointer, in points. */
const LIFT = 4;
/** How far a card gives under a thumb. */
const PRESSED_SCALE = 0.97;
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
  const [press] = useState(() => new Animated.Value(0));

  const to = (driver: Animated.Value, value: number) => {
    if (isReduced) return;
    Animated.spring(driver, {
      toValue: value,
      speed: 28,
      bounciness: value === 1 ? 0 : 6,
      useNativeDriver: USE_NATIVE,
    }).start();
  };

  const motion = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] }) },
      { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, PRESSED_SCALE] }) },
    ],
  };

  return (
    <Animated.View style={[outerStyle, motion]}>
      <Pressable
        {...props}
        onHoverIn={(event: MouseEvent) => {
          to(lift, 1);
          onHoverIn?.(event);
        }}
        onHoverOut={(event: MouseEvent) => {
          to(lift, 0);
          onHoverOut?.(event);
        }}
        onPressIn={(event: GestureResponderEvent) => {
          to(press, 1);
          onPressIn?.(event);
        }}
        onPressOut={(event: GestureResponderEvent) => {
          to(press, 0);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
