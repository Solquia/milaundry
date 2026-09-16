/**
 * The button at the foot of an ordering flow, in the shop's own colour.
 *
 * Both flows that take an order — the customer's booking page and the counter's
 * till — end every step with the same pair: a quiet way back sized one part,
 * and the commitment sized two. The app's `Button` wears the product's blue,
 * which is right for the dashboard and wrong here: these two screens belong to
 * the shop, and the shop's accent is what the rest of the page is painted in.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { space, type } from './ui-kit';

interface BrandButtonProps {
  title: string;
  onPress: () => void;
  /** The fill. `theme.brand` for the commitment, `theme.brandSoft` for Back. */
  fill: string;
  ink: string;
  /**
   * Share of the row: 2 for the commitment, 1 for the way back. Left out when
   * the button is the only thing on its line and takes the whole width.
   */
  flex?: number;
  disabled?: boolean;
}

export function BrandButton({ title, onPress, fill, ink, flex, disabled }: BrandButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { flex, backgroundColor: fill, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.text, { color: ink }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.cosy,
  },
  text: { ...type.label, fontSize: 16 },
});
