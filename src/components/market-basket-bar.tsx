/**
 * The bar at the foot of the market storefront: what is in the basket, what
 * it comes to, and the way to checkout — the strip every delivery app pins
 * under its menu. It is only drawn once something is in the basket, and it
 * rises into place so the first "+" visibly lands somewhere.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, RADII, colors, formatMoney, space, type } from './ui-kit';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Accent = (typeof ACCENTS)[number];

interface MarketBasketBarProps {
  count: number;
  /** The basket's price as the booking opens on it; null while it cannot be priced. */
  estimate: number | null;
  /** A load is priced at its smallest size, so the figure is a "from". */
  isFromPrice: boolean;
  accent: Accent;
  onCheckout: () => void;
  /** Shown instead of checking out: a paused shop, say. */
  blockedNote?: string | null;
}

export function MarketBasketBar({
  count,
  estimate,
  isFromPrice,
  accent,
  onCheckout,
  blockedNote,
}: MarketBasketBarProps) {
  const isReduced = useReducedMotion();
  const [rise] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      rise.setValue(1);
      return;
    }
    const run = Animated.spring(rise, { toValue: 1, damping: 16, stiffness: 180, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [isReduced, rise]);

  const price = estimate === null ? '' : `${isFromPrice ? 'from ' : ''}${formatMoney(estimate)}`;
  const isBlocked = Boolean(blockedNote);

  return (
    <Animated.View
      style={{
        opacity: rise,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      {blockedNote ? <Text style={styles.blocked}>{blockedNote}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View basket, ${count} ${count === 1 ? 'item' : 'items'}${price ? `, ${price}` : ''}`}
        accessibilityState={{ disabled: isBlocked }}
        disabled={isBlocked}
        onPress={onCheckout}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: isBlocked ? colors.borderStrong : accent.ink },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.badge}>
          <Ionicons name="basket" size={18} color={accent.ink} />
          <View style={[styles.count, { backgroundColor: accent.ink, borderColor: colors.card }]}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        <View style={styles.words}>
          <Text style={styles.title}>View basket</Text>
        </View>
        {price ? <Text style={styles.price}>{price}</Text> : null}
        <Ionicons name="chevron-forward" size={20} color={colors.onAccent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    minHeight: 56,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.control,
  },
  pressed: { opacity: 0.88 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { ...type.caption, fontSize: 11, fontWeight: '700', color: colors.onAccent },
  words: { flex: 1 },
  title: { ...type.label, color: colors.onAccent },
  caption: { ...type.caption, fontSize: 12, color: colors.onAccent, opacity: 0.85 },
  price: { ...type.label, fontSize: 16, color: colors.onAccent },
  blocked: { ...type.caption, color: colors.subtle, textAlign: 'center', marginBottom: space.snug },
});
