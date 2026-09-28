/**
 * The small pieces of the booking flow: a chip, the price in
 * the buy bar, the review rows. Used by the shared booking flow on the app and
 * on the shop's web page alike.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { bookingStyles as styles } from '@/components/booking-styles';
import { Odometer } from '@/components/odometer';
import { Button, Card, Screen, Subtle, colors, formatMoney } from '@/components/ui-kit';
import type { CatalogProblem } from '@/lib/domain/booking-error';
import { addonPriceLabel, type PickedAddon } from '@/lib/domain/shop-addons';
import type { OrderEstimate } from '@/lib/domain/pricing';

export function Chip({
  label,
  isSelected,
  onPress,
  style,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The one screen a customer sees when booking cannot start. Each cause carries
 * its own sentence, and only a recoverable one offers a retry.
 */
export function BookingProblem({
  problem,
  onRetry,
  onBack,
  onOpenShop,
}: {
  problem: CatalogProblem;
  onRetry: () => void;
  onBack: () => void;
  /** Offered when the shop is open but this service is not: pick another. */
  onOpenShop?: () => void;
}) {
  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>{problem.title}</Text>
        <Subtle>{problem.body}</Subtle>
      </Card>
      {problem.canRetry && <Button title="Try again" onPress={onRetry} />}
      {onOpenShop && <Button title="See the shop's services" onPress={onOpenShop} />}
      <Button title="Go back" variant="outline" onPress={onBack} />
    </Screen>
  );
}

/** One settled fact on the review: what it is called, and what it says. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

/**
 * The figure, or a dash. Nothing chosen is not "₱0.00": a zero set as the
 * loudest thing on the screen reads as a fault, not as a prompt.
 */
function priceAmount(estimate: OrderEstimate | null, hasSelection: boolean): string {
  if (estimate && hasSelection) return formatMoney(estimate.total);
  return '—';
}

/** The one line under the figure: what settles the price, or why there is none. */
function priceNote(
  estimate: OrderEstimate | null,
  hasSelection: boolean,
  /** What settles the price for this service: the scale, a count, or nothing. */
  finalPriceNote: string
): string {
  if (estimate) return finalPriceNote;
  if (hasSelection) {
    return "This shop's price list may have just changed — pick your items again.";
  }
  return 'Set how much you have and the price appears here.';
}

/**
 * The running total, the left half of the buy bar pinned under the page. The
 * figure keeps a fixed home so the layout never jumps, and an unpriceable selection reads as unknown rather than as
 * free.
 *
 * It sits beside the button rather than over it, the way a shop's checkout
 * bar does. The old footer stacked a 34pt figure, its note and two buttons,
 * and took a third of the screen from the products it was pricing.
 */
export function PriceSummary({
  estimate,
  hasSelection,
  finalPriceNote,
}: {
  estimate: OrderEstimate | null;
  hasSelection: boolean;
  finalPriceNote: string;
}) {
  const note = priceNote(estimate, hasSelection, finalPriceNote);
  return (
    <View style={styles.priceBlock}>
      <Text style={styles.priceLabel}>Total</Text>
      {/* An em dash is not a number and has no wheels to turn, so the
          unpriceable case stays plain text. */}
      {estimate && hasSelection ? (
        <Odometer
          value={priceAmount(estimate, hasSelection)}
          style={styles.priceValue}
          label={`Estimated total ${priceAmount(estimate, hasSelection)}`}
        />
      ) : (
        <Text style={[styles.priceValue, styles.priceValueMuted]}>
          {priceAmount(estimate, hasSelection)}
        </Text>
      )}
      {/* A set price has nothing left to settle, so it says nothing here. */}
      {note ? (
        <Text style={styles.priceNote} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** What went in the cart from the shop's shelf, already in the total. */
export function CartLine({ addons, extra }: { addons: readonly PickedAddon[]; extra: number }) {
  if (addons.length === 0) return null;
  const count = addons.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <View style={styles.cartLine}>
      <Ionicons name="bag-add-outline" size={16} color={colors.actionInk} />
      <Text style={styles.cartText} numberOfLines={1}>
        {count} add-on{count === 1 ? '' : 's'} ·{' '}
        {addons
          .map(({ addon, quantity }) => (quantity > 1 ? `${addon.name} ×${quantity}` : addon.name))
          .join(', ')}
      </Text>
      <Text style={styles.cartAmount}>{addonPriceLabel(extra)}</Text>
    </View>
  );
}

/** A small "Change" link in the corner of a review card: back to the step that asked. */
export function EditLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.editLinkText}>Change</Text>
    </Pressable>
  );
}
