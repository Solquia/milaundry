/**
 * An icon in the merchant header. The settings cog lives here so a screen that
 * adds its own header icon (the orders board's search) can keep the cog beside
 * it instead of redrawing it.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from './ui-kit';

export function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.subtle} />
    </Pressable>
  );
}

export function SettingsButton() {
  const router = useRouter();
  return (
    <HeaderButton
      icon="settings-outline"
      label="Shop settings"
      onPress={() => router.push('/(merchant)/settings')}
    />
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 8 },
  pressed: { opacity: 0.6 },
});
