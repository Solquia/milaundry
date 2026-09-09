import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device asks for less motion.
 *
 * Every animation in the app checks this and jumps to its settled state rather
 * than skipping the change entirely — a customer who turns motion off should
 * still see the same screen, just without the travel. Subscribes as well as
 * reads, because the setting can change while the app is open.
 */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (alive) setIsReduced(reduced);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduced
    );

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}
