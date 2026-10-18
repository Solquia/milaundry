import { usePathname, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ViewportProvider } from '@/components/viewport';
import { frameLayout } from '@/lib/domain/web-frame';

/** A cool light grey, a step under the app's own ground: the window around the column. */
const BACKDROP = '#E3E3E8';

/**
 * Holds the app to a phone-width column in a wide browser window, and
 * tells the tree inside how wide it really is.
 *
 * A shop's public page (`/s/`, `/track/`, `/claim/`, `/join/`) takes the
 * window instead — those routes have their own layout — and so does the
 * merchant dashboard on a laptop (`domain/desk-layout.ts`). A phone's browser,
 * and every native screen, falls straight through. The reasoning is in
 * `domain/web-frame.ts`.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const window = useWindowDimensions();
  const pathname = usePathname();
  const segments = useSegments();
  const frame = frameLayout({
    platform: Platform.OS,
    viewportWidth: window.width,
    pathname,
    isMerchant: segments[0] === '(merchant)',
  });

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
  column: {
    flex: 1,
    overflow: 'hidden',
    // The column sits on the window the way a device sits on a desk.
    boxShadow: '0 0 40px rgba(0, 0, 0, 0.08)',
  },
});
