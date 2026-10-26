/**
 * "A new version is ready": a tap away, never forced. See `use-app-update`.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppUpdate } from '@/lib/use-app-update';

import { colors, space, type } from './ui-kit';

export function UpdateBanner() {
  const { isReady, apply } = useAppUpdate();
  const insets = useSafeAreaInsets();
  if (!isReady) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="A new version of the app is ready. Tap to update now."
      onPress={apply}
      style={({ pressed }) => [styles.banner, { top: insets.top + space.snug }, pressed && styles.pressed]}
    >
      <Ionicons name="sparkles-outline" size={16} color={colors.onAccent} />
      <Text style={styles.text}>New version ready · Tap to update</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.action,
  },
  text: { ...type.label, color: colors.onAccent },
  pressed: { opacity: 0.85 },
});
