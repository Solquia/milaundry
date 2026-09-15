/**
 * The frame every public web page sits in.
 *
 * These pages are opened on a phone from a QR code or a shared link, so the
 * column is phone-width and centred; on a laptop it reads as a card on a
 * quiet field rather than stretching across the screen. A sticky footer holds
 * the one action the page exists for, so it never scrolls out of reach.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';

/** Phone-width: wide enough for a price row, narrow enough to stay one column. */
export const PAGE_MAX_WIDTH = 560;

interface WebShellProps {
  children: React.ReactNode;
  /** Pinned to the bottom of the viewport, inside the same column. */
  footer?: React.ReactNode;
}

export function WebShell({ children, footer }: WebShellProps) {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>{children}</View>
        <Text style={styles.credit}>Powered by MiLaundry</Text>
      </ScrollView>
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { alignItems: 'center', paddingBottom: space.gulf * 2 },
  column: { width: '100%', maxWidth: PAGE_MAX_WIDTH },
  credit: {
    ...type.caption,
    color: colors.subtle,
    textAlign: 'center',
    paddingTop: space.gulf,
  },
  footer: {
    alignItems: 'center',
    padding: space.room,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
