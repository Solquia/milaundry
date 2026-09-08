/**
 * The path the laundry walks, with the shop's colour on the step it is at.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import type { OrderStatus } from '@/lib/domain/order-status';
import { trackingSteps } from '@/lib/domain/order-tracking';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

interface TrackingStepsProps {
  status: OrderStatus;
  fulfillment: Fulfillment;
  theme: StorefrontTheme;
}

export function TrackingSteps({ status, fulfillment, theme }: TrackingStepsProps) {
  const steps = trackingSteps(status, fulfillment);
  if (steps.length === 0) return null;

  return (
    <View style={styles.card} accessibilityRole="list">
      {steps.map((step, index) => {
        const isDone = step.state === 'done';
        const isCurrent = step.state === 'current';
        return (
          <View key={step.status} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  isDone && { backgroundColor: theme.brand, borderColor: theme.brand },
                  isCurrent && { borderColor: theme.brand, backgroundColor: theme.brandSoft },
                ]}
              />
              {index < steps.length - 1 ? (
                <View style={[styles.link, isDone && { backgroundColor: theme.brand }]} />
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                isCurrent && { color: theme.brandInk, fontWeight: '700' },
                step.state === 'upcoming' && styles.upcoming,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
  },
  row: { flexDirection: 'row', gap: space.cosy, minHeight: 32 },
  rail: { width: 16, alignItems: 'center' },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginTop: 3,
  },
  link: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  label: { ...type.body, color: colors.text, paddingBottom: space.cosy },
  upcoming: { color: colors.subtle },
});
