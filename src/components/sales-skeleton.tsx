/**
 * The screen's shape while the orders load, so the layout is there at once
 * and the figures fade in, instead of a lone spinner on a blank page.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { CROWN, RADII, colors, space } from './ui-kit';

function Block({ height, radius = RADII.card, flex }: { height: number; radius?: number; flex?: number }) {
  return <View style={[styles.block, { height, borderRadius: radius, flex }]} />;
}

export function SalesSkeleton() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.page, style]}
      accessibilityLabel="Loading your sales"
      accessibilityRole="progressbar"
    >
      <View style={[styles.hero, CROWN]}>
        <Block height={32} radius={RADII.pill} />
        <Block height={48} radius={RADII.control} />
        <View style={styles.row}>
          {[0, 1, 2, 3].map((key) => (
            <Block key={key} height={62} radius={RADII.control} flex={1} />
          ))}
        </View>
        <Block height={120} radius={RADII.control} />
      </View>
      <Block height={170} />
      <Block height={140} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.section, padding: space.room },
  hero: { gap: space.room, padding: space.room, backgroundColor: colors.takingsSurface },
  row: { flexDirection: 'row', gap: space.snug },
  block: { backgroundColor: colors.border },
});