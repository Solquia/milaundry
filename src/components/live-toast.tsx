/**
 * A payment landing while the screen is open: "+₱180 · GCash · Aling Nena"
 * slides in over the top and leaves on its own, the way a seller app pings
 * a new sale. It never blocks a tap underneath.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { formatMoney } from '@/lib/domain/money';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import type { SalesPayment } from '@/lib/domain/sales-metrics';

import { RADII, colors, elevation, space, type } from './ui-kit';

const SHOWN_MS = 3_500;

export function LiveToast({ payment, onDone }: { payment: SalesPayment | null; onDone: () => void }) {
  useEffect(() => {
    if (!payment) return;
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [payment, onDone]);

  if (!payment) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        key={payment.id}
        entering={FadeInUp.springify().damping(16)}
        exiting={FadeOutUp}
        style={styles.toast}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`New payment: ${formatMoney(payment.amount)} by ${PAYMENT_LABELS[payment.method]} from ${payment.name}`}
      >
        <View style={styles.coin}>
          <Ionicons name="arrow-down" size={14} color={colors.onAccent} />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.amount}>+{formatMoney(payment.amount)}</Text>
          {`  ·  ${PAYMENT_LABELS[payment.method]}  ·  ${payment.name}`}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: space.snug, left: space.room, right: space.room, zIndex: 20 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.snug,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    backgroundColor: colors.text,
    ...elevation.lift,
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moneyIn,
  },
  text: { ...type.caption, color: colors.onAccent, flex: 1 },
  amount: { fontWeight: '800' },
});