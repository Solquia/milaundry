import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ViewportProvider } from '@/components/viewport';
import { frameLayout } from '@/lib/domain/web-frame';

/** The deep navy the splash opens on: the window around the column. */
const BACKDROP = '#04203F';

/**
 * Holds everything to a phone-width column in a wide browser window, and
 * tells the tree inside how wide it really is.
 *
 * A phone's browser, and every native screen, falls straight through to the
 * children — the column is the window there, so there is nothing to draw
 * around it. The reasoning is in `domain/web-frame.ts`.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const window = useWindowDimensions();
  const frame = frameLayout({ platform: Platform.OS, viewportWidth: window.width });

  return (
    <ViewportProvider width={frame.width} height={window.height}>
      {frame.isFramed ? (
        <View style={styles.backdrop}>
          <View style={[styles.column, { width: frame.width }]}>{children}</View>
        </View>
      ) : (
        children
      )}
    </ViewportProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: BACKDROP, alignItems: 'center' },
  column: { flex: 1, overflow: 'hidden' },
});
