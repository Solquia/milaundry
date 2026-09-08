import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { frameLayout } from '@/lib/domain/web-frame';

const BACKDROP = '#04203F';

/**
 * Holds the app to a phone-width column in a wide browser window. Everywhere
 * else it is nothing but its children.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const frame = frameLayout({ platform: Platform.OS, viewportWidth: width });
  if (!frame.isFramed) return <>{children}</>;
  return (
    <View style={styles.backdrop}>
      <View style={[styles.column, { width: frame.width }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: BACKDROP, alignItems: 'center' },
  column: { flex: 1, overflow: 'hidden' },
});
