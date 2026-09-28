/**
 * A shop's sign on the door, as the customer sees it: a small pill with a
 * power light — the same little lamp on a washing machine's panel.
 *
 *  - green and breathing while the shop is open,
 *  - amber in the last hour, so a late drop-off is not a surprise,
 *  - grey after hours, with when it opens (orders still go in to book ahead),
 *  - red when the owner has flipped the sign or blocked the day — the one
 *    state that means "you cannot order right now".
 *
 * The light only breathes while the shop is open: a pulsing dot reads as
 * "live", and a closed shop is not.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, type } from './ui-kit';
import type { ShopState, ShopStatus } from '@/lib/domain/shop-availability';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const LIGHT_SIZE = 8;
const BREATH_MS = 1600;

export const STATUS_TONES: Record<ShopState, { light: string; ink: string }> = {
  open: { light: '#16A34A', ink: colors.moneyIn },
  'closing-soon': { light: '#F59E0B', ink: colors.moneyOut },
  closed: { light: '#94A3B8', ink: colors.subtle },
  paused: { light: '#E11D48', ink: '#A32B52' },
  holiday: { light: '#E11D48', ink: '#A32B52' },
};

export function ShopStatusPill({
  status,
  showDetail = true,
  style,
}: {
  status: ShopStatus;
  /** Off where space is tight: the label alone still says open or shut. */
  showDetail?: boolean;
  style?: ViewStyle;
}) {
  const tone = STATUS_TONES[status.state];
  const isLive = status.state === 'open' || status.state === 'closing-soon';
  const text = showDetail && status.detail ? `${status.label} · ${status.detail}` : status.label;

  return (
    <View
      style={[styles.pill, style]}
      accessibilityRole="text"
      accessibilityLabel={
        status.isTakingOrders ? text : `${text}. Not taking orders right now.`
      }
    >
      <PowerLight color={tone.light} isLive={isLive} />
      <Text style={[styles.text, { color: tone.ink }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** The lamp alone, breathing while `isLive`; the merchant's door sign wears it too. */
export function PowerLight({ color, isLive }: { color: string; isLive: boolean }) {
  const isReduced = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLive || isReduced) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(breath, {
        toValue: 1,
        duration: BREATH_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [breath, isLive, isReduced]);

  return (
    <View style={styles.lightBox}>
      {isLive ? (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: color,
              opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
            },
          ]}
        />
      ) : null}
      <View style={[styles.light, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    // Solid enough to read over any photo, a busy flyer included.
    backgroundColor: 'rgba(255,255,255,0.95)',
    maxWidth: '100%',
  },
  lightBox: {
    width: LIGHT_SIZE,
    height: LIGHT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: LIGHT_SIZE,
    height: LIGHT_SIZE,
    borderRadius: LIGHT_SIZE / 2,
  },
  light: { width: LIGHT_SIZE, height: LIGHT_SIZE, borderRadius: LIGHT_SIZE / 2 },
  text: { ...type.caption, fontSize: 11, lineHeight: 14, fontFamily: type.label.fontFamily, flexShrink: 1 },
});
