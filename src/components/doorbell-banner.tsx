import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DoorbellBannerCopy } from '@/lib/domain/shop-doorbell';

import { colors, elevation, space, type } from './ui-kit';

const HOLD_MS = 8_000;

/**
 * The thing the counter cannot miss: a new booking, on top of whatever
 * screen they were on, for a few seconds, with a way to open it.
 */
export function DoorbellBanner({
  notice,
  onOpen,
  onDismiss,
}: {
  notice: DoorbellBannerCopy;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, HOLD_MS);
    return () => clearTimeout(timer);
  }, [notice.orderId, onDismiss]);

  const isTest = notice.orderId === 'test';
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} accessibilityLiveRegion="assertive">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${notice.title}. ${notice.body}`}
        onPress={isTest ? onDismiss : onOpen}
        style={styles.card}
      >
        <View style={styles.mark}>
          <Ionicons name="notifications" size={20} color={colors.onAccent} />
        </View>
        <View style={styles.words}>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.body}>{notice.body}</Text>
        </View>
        <Text style={styles.action}>{isTest ? 'OK' : notice.actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    left: space.room,
    right: space.room,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    backgroundColor: colors.action,
    borderRadius: 16,
    paddingVertical: space.snug,
    paddingHorizontal: space.cosy,
    ...elevation.lift,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, gap: 2 },
  title: { ...type.label, color: colors.onAccent },
  body: { ...type.caption, color: colors.onAccent },
  action: { ...type.label, color: colors.onAccent },
});
