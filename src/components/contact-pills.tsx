/**
 * The two ways to reach a customer, as buttons rather than a link hidden in a
 * phone number. Rendered nowhere when there is no number, and the caller says
 * so in its own words — "no number on file" means something different on an
 * order than it does in the customer book.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from './ui-kit';

function Pill({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={colors.actionInk} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export function ContactPills({ phone }: { phone: string }) {
  return (
    <View style={styles.row}>
      <Pill
        icon="call-outline"
        label={phone}
        accessibilityLabel={`Call ${phone}`}
        onPress={() => Linking.openURL(`tel:${phone}`)}
      />
      <Pill
        icon="chatbubble-outline"
        label="Text"
        accessibilityLabel={`Text ${phone}`}
        onPress={() => Linking.openURL(`sms:${phone}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.cosy + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.8 },
  pillText: { ...type.label, color: colors.text },
});
