/**
 * The booking flow's styles, shared by its parts, the flow itself and the
 * app screen that hosts it — one sheet, so the app and the shop's web page
 * cannot draw the same step two ways.
 */
import { StyleSheet } from 'react-native';

import { RADII, colors, space, type } from '@/components/ui-kit';
import { fontFor } from '@/lib/domain/design-scale';

export const bookingStyles = StyleSheet.create({
  // Identity block. Sits above the first card, so the first bordered surface
  // the eye lands on is a decision rather than a restatement of the title.
  header: { gap: space.cosy, paddingTop: space.tight },

  /** Sections breathe wider than the rows inside them: 20 against 12 and 8. */
  sections: { gap: space.section },
  sectionTitle: { ...type.section, color: colors.text },
  sectionMeta: { ...type.body, fontSize: 15 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** Four quick sizes on one row, so none strands alone on a second line. */
  quickChip: { flexBasis: '22%', flexGrow: 1 },
  // iOS's filled option: grey at rest, the tint once chosen, no outline.
  chip: {
    borderRadius: RADII.control - 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: space.room,
    minHeight: 44,
    paddingVertical: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
  },
  chipText: { ...type.body, fontSize: 15, lineHeight: 20, ...fontFor(600), color: colors.text },
  chipTextSelected: { color: colors.onAccent },


  /** A condition on the price, not an announcement: it sits at caption weight
      and takes its blue from the ink that carries text, not the identity. */
  noticeText: { ...type.caption, ...fontFor(600) },

  // The review: the booking read back to you before the last tap.
  reviewLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingTop: space.cosy,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60, 60, 67, 0.22)',
  },
  reviewLineText: { flex: 1, gap: space.tight },
  reviewName: { ...type.body, fontSize: 17, lineHeight: 22, color: colors.text },
  reviewMeta: { ...type.caption, color: colors.subtle },
  reviewAmount: { ...type.body, fontSize: 17, lineHeight: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  reviewLabel: { ...type.body, color: colors.subtle },
  /** Right-aligned into whatever the label leaves, like the schedule legs. */
  reviewValue: { ...type.body, color: colors.text, flex: 1, textAlign: 'right' },

  // The buy bar, pinned in the footer: the total, then the action.
  buyBar: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  priceBlock: { flex: 1, minWidth: 0 },
  backAction: { width: 92 },
  // Wide, like a food app's basket button: the one thing the bar is for.
  mainAction: { flex: 1.2 },
  priceLabel: { ...type.caption, color: colors.subtle },
  priceValue: { ...type.value, fontVariant: ['tabular-nums'] },
  priceValueMuted: { color: colors.subtle },
  priceNote: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  /** The cart: what came off the shop's shelf, and what it adds. */
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 6,
    borderRadius: RADII.chip,
    borderCurve: 'continuous',
  },
  cartText: { ...type.caption, ...fontFor(600), flex: 1 },
  cartAmount: { ...type.caption, ...fontFor(600) },
  commitRow: { flexDirection: 'row', gap: space.snug },
  commitHalf: { flex: 1 },
  headerBack: { marginLeft: space.snug, padding: space.tight },

  /** A review card's heading, with its way back to the step that asked. */
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  editLink: { minHeight: 32, justifyContent: 'center' },
  editLinkText: { ...type.body, fontSize: 17 },
  /** "Book again" says so once, above the review it filled in. */
  rebookNote: {
    gap: space.tight,
    padding: space.room,
    borderRadius: RADII.card - 4,
    borderCurve: 'continuous',
  },
  rebookTitle: { ...type.section },
  rebookBody: { ...type.body, color: colors.text },
});
