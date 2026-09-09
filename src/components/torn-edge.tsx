import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The torn edge of a receipt.
 *
 * A thermal slip is never a rectangle. It is cut at the top and ripped off the
 * roll at the bottom, and that ragged edge is the one detail that makes paper
 * read as paper rather than as a white box with a monospaced font in it.
 *
 * Drawn as the *page* colour biting into the card rather than as an image: the
 * teeth are a filled path in whatever sits behind the paper, so the card
 * underneath stays an ordinary surface and nothing has to be re-cut when its
 * height or content changes.
 *
 * Purely decorative. It carries nothing a customer needs, so it is hidden from
 * assistive technology and cannot take a touch.
 */

/** How tall one tooth is. Deep enough to read, shallow enough not to eat text. */
const TOOTH_HEIGHT = 7;
/** How wide. Roughly the pitch of a real perforation at this scale. */
const TOOTH_WIDTH = 13;

/** So the card can pad itself clear of the teeth at both ends. */
export const TORN_EDGE_HEIGHT = TOOTH_HEIGHT;

/** How far the punched notches bite into the ticket from each side. */
const NOTCH = 20;

/**
 * The line a ticket is meant to be torn along.
 *
 * Two punched notches and a dashed rule between them — the cinema-stub
 * geometry, which is the one piece of visual language that says "this part
 * detaches" without a word. It divides what the shop is doing from what the
 * customer owes, which is exactly the seam a real ticket is torn on.
 *
 * The notches are full circles in the page colour, placed half outside the
 * ticket; the ticket's own `overflow: 'hidden'` does the cutting, so the punch
 * is a clip rather than a shape that has to be kept in sync with the width.
 */
export function TicketPerforation({
  color,
  ruleColor,
}: {
  /** What sits behind the ticket — the punches are cut in it. */
  color: string;
  ruleColor: string;
}) {
  return (
    <View style={styles.perforation}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.notch, { left: -NOTCH / 2, backgroundColor: color }]}
      />
      <View style={[styles.rule, { borderColor: ruleColor }]} />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.notch, { right: -NOTCH / 2, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  perforation: { flexDirection: 'row', alignItems: 'center', height: NOTCH },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  // Inset past the punches so the dashes start where the paper does.
  rule: { flex: 1, marginHorizontal: NOTCH / 2, borderBottomWidth: 1, borderStyle: 'dashed' },
});

export function TornEdge({
  width,
  color,
  edge,
}: {
  width: number;
  /** What sits behind the paper: the teeth are cut out of the card in it. */
  color: string;
  edge: 'top' | 'bottom';
}) {
  if (width <= 0) return null;

  const teeth = Math.max(1, Math.round(width / TOOTH_WIDTH));
  // Derived from the real width rather than fixed, so the last tooth is never a
  // sliver left over against the card's corner.
  const pitch = width / teeth;

  // The zigzag runs along the paper's edge; the shape is closed off against the
  // outside of the card, so what gets filled is the bite taken out of it.
  const outer = edge === 'top' ? 0 : TOOTH_HEIGHT;
  const inner = edge === 'top' ? TOOTH_HEIGHT : 0;

  const points: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const left = i * pitch;
    points.push(`L ${left + pitch / 2} ${inner}`);
    points.push(`L ${left + pitch} ${outer}`);
  }

  const path = `M 0 ${outer} ${points.join(' ')} L ${width} ${outer} Z`;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { position: 'absolute', left: 0, right: 0, height: TOOTH_HEIGHT },
        edge === 'top' ? { top: 0 } : { bottom: 0 },
      ]}
    >
      <Svg width={width} height={TOOTH_HEIGHT}>
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
}
