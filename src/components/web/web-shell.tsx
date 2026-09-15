/**
 * The frame every public web page sits in.
 *
 * A shop's page is read on a phone — from a QR code on the counter, a link in
 * a message — so the phone is the layout, and `web-frame.tsx` gives it that
 * same phone-width column on a laptop rather than a second design to keep in
 * step. What changes here is what a phone itself varies: how wide the screen
 * is, how tall, and whether the glass runs under a notch or a home indicator.
 *
 * The hero runs edge to edge. The action the page exists for is pinned across
 * the foot, clear of the home indicator and always within thumb reach. The
 * sizes are `domain/web-layout.ts`; the shape the aside takes when there is
 * ever room for two columns is still here, waiting on that one constant.
 */
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { useViewport } from '@/components/viewport';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { webLayout, type WebLayout } from '@/lib/domain/web-layout';

/**
 * The box this page is being drawn in, and what that means for its shape.
 *
 * The box, not the browser window: on a laptop the page is a phone-width
 * column and must lay itself out to the column. `components/viewport.tsx`
 * holds that distinction. Height matters too — it is what keeps the hero off
 * a phone held sideways.
 */
export function useWebLayout(): WebLayout {
  const { width, height } = useViewport();
  return webLayout(width, height);
}

interface WebShellProps {
  children: React.ReactNode;
  /**
   * Runs the full width of the window, above everything. Constrain its own
   * inner content with `useWebLayout().contentWidth` so the words stay with
   * the column even when the colour does not.
   */
  hero?: React.ReactNode;
  /**
   * Supporting material. Under the main column on a phone; beside it, in its
   * own column, once the window is wide enough to hold both.
   */
  aside?: React.ReactNode;
  /**
   * The one action the page exists for. Pinned across the foot of a narrow
   * window so it never scrolls out of reach; on a wide one it sits at the top
   * of the side column and follows the scroll from there.
   */
  footer?: React.ReactNode;
}

export function WebShell({ children, hero, aside, footer }: WebShellProps) {
  const layout = useWebLayout();
  const column = { maxWidth: layout.contentWidth };
  const hasFootBar = Boolean(footer) && !layout.hasAside;

  return (
    <View style={styles.page}>
      {/* No scrollbar gutter. A classic 13px bar reserved its width from the
          layout, so the hero and the page band stopped short of the column's
          right edge and left a pale strip down the side of every page. A phone
          overlays its scrollbar; the column does the same. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, hasFootBar && styles.scrollPastFootBar]}
      >
        {hero}
        <View style={[styles.column, column]}>
          {layout.hasAside ? (
            <View style={[styles.columns, { gap: layout.gutter }]}>
              <View style={styles.main}>{children}</View>
              <View style={[styles.side, { width: layout.asideWidth, gap: layout.gutter }]}>
                {footer ? (
                  <View style={[styles.sideFooter, { padding: layout.gutter, top: layout.gutter }]}>
                    {footer}
                  </View>
                ) : null}
                {aside}
              </View>
            </View>
          ) : (
            <>
              {children}
              {aside}
            </>
          )}
        </View>
      </ScrollView>
      {hasFootBar ? (
        <View style={[styles.footer, { paddingHorizontal: layout.gutter }]}>
          <View style={[styles.column, column]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

interface PageBandProps {
  /** The page this one hangs off. Drawn as a way back to it. */
  backLabel: string;
  onBack: () => void;
  title: string;
  theme: StorefrontTheme;
}

/**
 * The brand band the inner pages wear instead of a hero: where you came from,
 * and what this page is asking. Full-bleed colour, column-width words.
 */
export function PageBand({ backLabel, onBack, title, theme }: PageBandProps) {
  const layout = useWebLayout();
  return (
    <View style={[styles.band, { backgroundColor: theme.brand, paddingHorizontal: layout.gutter }]}>
      <View style={[styles.column, styles.bandInner, { maxWidth: layout.contentWidth }]}>
        <Pressable accessibilityRole="link" onPress={onBack}>
          <Text style={[styles.bandBack, { color: theme.onBrand }]}>‹ {backLabel}</Text>
        </Pressable>
        <Text style={[styles.bandTitle, { color: theme.onBrand }]}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  /**
   * Children stretch; they are not centred.
   *
   * Centring here sized every direct child to its own contents, so the hero
   * and the page band — the two blocks whose whole job is to run edge to edge —
   * shrank to the width of the words inside them and sat in the middle with the
   * field showing at both shoulders. The full-bleed blocks take the width;
   * `styles.column` is what centres the reading content within it.
   */
  scroll: { paddingBottom: space.gulf * 2 },
  column: { width: '100%', alignSelf: 'center' },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  /** `minWidth: 0` or a wide price grid pushes the aside off the page. */
  main: { flex: 1, minWidth: 0 },
  side: { flexShrink: 0 },
  /**
   * Follows the page down on the web, which is the whole point of moving the
   * action out of the foot bar: it stays in reach without lying across the
   * content. Native has no sticky positioning and does not need one — no
   * native screen is ever wide enough to take this branch.
   */
  sideFooter: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.snug,
    ...Platform.select({ web: { position: 'sticky' } as object, default: {} }),
  },
  band: { paddingVertical: space.room },
  bandInner: { gap: space.snug },
  bandBack: { ...type.caption, fontWeight: '600', opacity: 0.9 },
  bandTitle: { ...type.title },
  /**
   * The bar across the foot of a phone.
   *
   * On a handset with a home indicator the bottom 34px of the glass is the
   * system's, and a bar padded by a flat 16 put 'Book online' underneath it —
   * reachable, but with the swipe bar drawn through the label. `max()` takes
   * the inset when there is one and the ordinary padding when there is not, so
   * a notchless phone and a browser column are unchanged.
   */
  footer: {
    alignItems: 'center',
    paddingTop: space.room,
    paddingBottom: space.room,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...Platform.select({
      web: {
        /**
         * Stuck to the foot of the window, not to the end of the document.
         *
         * The bar is the last child of a column that is meant to be exactly
         * one window tall, and on a phone it is. When anything lets that
         * column grow — a page longer than the glass, a browser that has not
         * given the flex chain a height — the bar goes with it, and the one
         * button the page exists for ends up below the fold. A customer who
         * has just set their weight sees no way forward.
         *
         * `sticky` costs nothing when the column really is a window tall: the
         * bar is already at the bottom, and it stays there. It only does
         * anything in the case that used to lose the button.
         */
        position: 'sticky',
        bottom: 0,
        paddingBottom: `max(${space.room}px, env(safe-area-inset-bottom))`,
      } as object,
      default: {},
    }),
  },
  /**
   * Room under the last line for the bar to sit over. Without it the credit
   * line — and, on a short list, the last price card — ends up behind it.
   */
  scrollPastFootBar: {
    paddingBottom: space.gulf * 4,
    ...Platform.select({
      web: { paddingBottom: `calc(${space.gulf * 4}px + env(safe-area-inset-bottom))` } as object,
      default: {},
    }),
  },
});
