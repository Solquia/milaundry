/**
 * The booking flow's styles, shared by its parts, the flow itself and the
 * app screen that hosts it — one sheet, so the app and the shop's web page
 * cannot draw the same step two ways.
 */
import { StyleSheet } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';

export const bookingStyles = StyleSheet.create({
  // Identity block. Sits above the first card, so the first bordered surface
  // the eye lands on is a decision rather than a restatement of the title.
  header: { gap: space.cosy, paddingTop: space.tight },

  /** Sections breathe wider than the rows inside them: 20 against 12 and 8. */
  sections: { gap: space.section },
  sectionTitle: { ...type.section, color: colors.text },
  sectionMeta: { ...type.label, color: colors.actionInk },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** Four quick sizes on one row, so none strands alone on a second line. */
  quickChip: { flexBasis: '22%', flexGrow: 1 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.room,
    // 14pt text on 12+12 still clears the 44pt touch minimum without a hitSlop.
    paddingVertical: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { ...type.label, color: colors.text },
  chipTextSelected: { color: colors.onAccent },

  /** The schedule as one object with two rows, rather than two loose stacks. */
  legGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  legSeam: { height: 1, backgroundColor: colors.border },
  /** 14pt label on 14+14 clears the 44pt touch minimum without a hitSlop. */
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingVertical: space.room - 2,
  },
  /** Open reads as the row the chips below belong to, not as a selection. */
  legRowOpen: { backgroundColor: colors.actionSurface },
  legLabel: { ...type.label, color: colors.subtle },
  /** The answer. Right-aligned into whatever the label leaves, and the reason
      the chips can stay closed. */
  legValue: { ...type.label, flex: 1, textAlign: 'right', color: colors.text },
  /** No side padding: the chips are rails, and a rail that stops short of the
      edge looks like it has ended rather than scrolled. Their own 12 holds
      them off the border. */
  legPanel: {
    gap: space.snug,
    paddingTop: space.cosy,
    paddingBottom: space.cosy,
    backgroundColor: colors.actionSurface,
  },
  /** The wait, stated once for the pair: the label carries it, the sentence
      spends the rest of the line explaining what it means. */
  turnaroundRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.snug,
    marginTop: -space.tight,
  },
  turnaroundLabel: { ...type.label, color: colors.actionInk },
  turnaroundNote: { ...type.caption, color: colors.subtle, flexShrink: 1 },

  /** A condition on the price, not an announcement: it sits at caption weight
      and takes its blue from the ink that carries text, not the identity. */
  noticeText: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk },

  // The review: the booking read back to you before the last tap.
  reviewLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewLineText: { flex: 1, gap: space.tight },
  reviewName: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewMeta: { ...type.caption, color: colors.subtle },
  reviewAmount: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  reviewLabel: { ...type.label, color: colors.subtle },
  /** Right-aligned into whatever the label leaves, like the schedule legs. */
  reviewValue: { ...type.body, color: colors.text, flex: 1, textAlign: 'right' },

  // The buy bar, pinned in the footer: the total, then the action.
  buyBar: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  priceBlock: { flex: 1, minWidth: 0 },
  backAction: { width: 92 },
  mainAction: { minWidth: 148 },
  priceLabel: { ...type.caption, color: colors.subtle },
  priceValue: { ...type.value, color: colors.text },
  priceValueMuted: { color: colors.subtle },
  priceNote: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  /** The cart: what came off the shop's shelf, and what it adds. */
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.actionSurface,
  },
  cartText: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk, flex: 1 },
  cartAmount: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.actionInk },
  commitRow: { flexDirection: 'row', gap: space.snug },
  headerBack: { marginLeft: space.snug, padding: space.tight },

  /** A review card's heading, with its way back to the step that asked. */
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  editLink: { minHeight: 32, justifyContent: 'center' },
  editLinkText: { ...type.label, color: colors.actionInk },
  /** "Book again" says so once, above the review it filled in. */
  rebookNote: {
    gap: space.tight,
    padding: space.room,
    borderRadius: 14,
    backgroundColor: colors.actionSurface,
  },
  rebookTitle: { ...type.section, color: colors.actionInk },
  rebookBody: { ...type.body, color: colors.text },
});
