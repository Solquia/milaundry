/**
 * A heading for one region of a screen, with room for a caption under it and
 * one quiet action beside it — "See all", never a button.
 *
 * Under the title runs a short swash: a stroke with a rise and a fall in it,
 * drawn rather than ruled. A straight 1px rule under a heading is the most
 * formal mark an interface can make, and the screens were full of them. This
 * is the one place the product lets a line wobble.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, space, type } from './ui-kit';

const SWASH_WIDTH = 46;
const SWASH_HEIGHT = 7;

/** The stroke under a heading. One curve up, one down, tapered by round caps. */
function Swash({ color }: { color: string }) {
  return (
    // The hiding sits on a View rather than on the Svg: react-native-svg hands
    // whatever it does not recognise straight to the DOM, and React rejects
    // `accessibilityElementsHidden` there. A View maps it on both platforms.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SWASH_WIDTH} height={SWASH_HEIGHT} viewBox="0 0 46 7">
        <Path
          d="M2 5.2 C 9 1.2, 16 1.4, 23 3.6 S 37 6, 44 2.2"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export function SectionHeading({
  title,
  caption,
  actionLabel,
  onAction,
}: {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.words}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Swash color={colors.actionMuted} />
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={styles.action}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.snug,
    marginTop: space.snug,
  },
  words: { flex: 1, gap: 1 },
  title: { ...type.section, color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  action: { paddingVertical: space.tight },
  actionText: { ...type.label, color: colors.actionInk },
});
