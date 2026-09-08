/**
 * The price list that is the basket.
 *
 * A visitor reading a shop's prices is already deciding what to send. So the
 * list does not point at a booking form; it *is* the first step of one. A
 * row at rest shows the price and a "+". A tap opens a stepper inside the
 * row, the row takes on the shop's colour, and the figure becomes what that
 * line now costs for the chosen quantity. The one button at the bottom of
 * the page counts the order up as it grows.
 *
 * Every category is a plain heading on one white sheet; nothing is said
 * twice. A shop that is not taking bookings gets the same sheet with no
 * controls.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { lineSummary } from '@/lib/domain/basket-copy';
import { formatMoneyCompact } from '@/lib/domain/money';
import { minimumLabel, unitCaption } from '@/lib/domain/price-label';
import { estimateLineTotal } from '@/lib/domain/pricing';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import type { Cart } from '@/lib/domain/web-cart';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

const TINT_MS = 180;
const CONTROL = 36;

type Adjust = (service: StorefrontService, direction: 1 | -1) => void;

interface PriceListProps {
  services: readonly StorefrontService[];
  theme: StorefrontTheme;
  /** The basket, and the one way to change it. Both absent when the shop cannot take bookings. */
  cart?: Cart;
  onAdjust?: Adjust;
}

export function PriceList({ services, theme, cart, onAdjust }: PriceListProps) {
  const groups = groupServicesByCategory(services);

  if (groups.length === 0) {
    return (
      <View style={styles.sheet}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No prices posted yet</Text>
          <Text style={styles.emptyBody}>Call the shop and they will quote you.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      {groups.map((group, index) => (
        <View key={group.category}>
          <Text style={[styles.heading, index > 0 && styles.headingAfterGroup]}>
            {CATEGORY_LABELS[group.category]}
          </Text>
          {group.services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              theme={theme}
              quantity={cart?.[service.id] ?? 0}
              onAdjust={onAdjust}
            />
          ))}
        </View>
      ))}
      {onAdjust ? (
        <Text style={styles.footnote}>
          Tap a service to add it. Guess the weight; the shop weighs it and confirms the price before
          you pay.
        </Text>
      ) : null}
    </View>
  );
}

interface ServiceRowProps {
  service: StorefrontService;
  theme: StorefrontTheme;
  quantity: number;
  onAdjust?: Adjust;
}

function ServiceRow({ service, theme, quantity, onAdjust }: ServiceRowProps) {
  const isBookable = Boolean(onAdjust);
  const isInBasket = quantity > 0;
  const [isHovered, setIsHovered] = useState(false);
  const [tint] = useState(() => new Animated.Value(isInBasket ? 1 : 0));
  const [bump] = useState(() => new Animated.Value(1));

  // The colour follows the basket, not the tap: it is the line's existence
  // that is shown, so a line restored from a link is tinted too.
  useEffect(() => {
    Animated.timing(tint, {
      toValue: isInBasket ? 1 : 0,
      duration: TINT_MS,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [isInBasket, tint]);

  // A small spring on every change of quantity: the number lands, it does not blink.
  useEffect(() => {
    if (!isInBasket) return;
    bump.setValue(1.18);
    Animated.spring(bump, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [quantity, isInBasket, bump]);

  const background = tint.interpolate({
    inputRange: [0, 1],
    outputRange: [isBookable && isHovered ? colors.bg : colors.card, theme.brandSoft],
  });
  const unit = unitCaption(service.unit);
  const minimum = minimumLabel(service);
  const summary = isInBasket
    ? lineSummary({ service, quantity, subtotal: estimateLineTotal(service, quantity) })
    : null;
  const canAddByRow = isBookable && !isInBasket;

  return (
    <Pressable
      accessibilityRole={canAddByRow ? 'button' : undefined}
      accessibilityLabel={canAddByRow ? `Add ${service.name}` : undefined}
      // Never `disabled`: on the web that would disable the stepper inside it.
      onPress={canAddByRow ? () => onAdjust?.(service, 1) : undefined}
      onHoverIn={canAddByRow ? () => setIsHovered(true) : undefined}
      onHoverOut={() => setIsHovered(false)}
      style={canAddByRow ? styles.pointer : undefined}
    >
      <Animated.View style={[styles.row, { backgroundColor: background }]}>
        <View style={styles.words}>
          <Text style={styles.name}>{service.name}</Text>
          {service.description ? <Text style={styles.description}>{service.description}</Text> : null}
          {summary ? (
            <Text style={[styles.summary, { color: theme.brandInk }]}>{summary}</Text>
          ) : minimum ? (
            <Text style={styles.minimum}>{minimum}</Text>
          ) : null}
        </View>
        {isInBasket && onAdjust ? (
          <Stepper service={service} quantity={quantity} theme={theme} bump={bump} onAdjust={onAdjust} />
        ) : (
          <>
            <Text style={[styles.price, { color: theme.brandInk }]}>
              {formatMoneyCompact(service.price)}
              {unit ? <Text style={styles.unit}>{unit}</Text> : null}
            </Text>
            {isBookable ? (
              <View style={[styles.add, { backgroundColor: theme.brandSoft }]}>
                <Ionicons name="add" size={20} color={theme.brandInk} />
              </View>
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

interface StepperProps {
  service: StorefrontService;
  quantity: number;
  theme: StorefrontTheme;
  bump: Animated.Value;
  onAdjust: Adjust;
}

function Stepper({ service, quantity, theme, bump, onAdjust }: StepperProps) {
  const isFlat = service.unit === 'flat';
  const shown = isFlat ? 'Added' : service.unit === 'per_kg' ? `${quantity} kg` : `${quantity}`;
  return (
    <View style={[styles.stepper, { borderColor: theme.brand }]}>
      <StepButton
        icon={isFlat || quantity <= 1 ? 'trash-outline' : 'remove'}
        label={`Remove ${isFlat ? '' : 'one '}${service.name}`}
        ink={theme.brand}
        onPress={() => onAdjust(service, -1)}
      />
      <Animated.Text
        accessibilityLiveRegion="polite"
        style={[styles.quantity, { color: theme.brandInk, transform: [{ scale: bump }] }]}
      >
        {shown}
      </Animated.Text>
      {isFlat ? (
        <View style={styles.stepButton}>
          <Ionicons name="checkmark" size={18} color={theme.brand} />
        </View>
      ) : (
        <StepButton
          icon="add"
          label={`Add one more ${service.name}`}
          ink={theme.brand}
          onPress={() => onAdjust(service, 1)}
        />
      )}
    </View>
  );
}

interface StepButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  ink: string;
  onPress: () => void;
}

function StepButton({ icon, label, ink, onPress }: StepButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
    >
      <Ionicons name={icon} size={18} color={ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.snug,
    overflow: 'hidden',
  },
  heading: {
    ...type.section,
    color: colors.text,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.tight,
  },
  headingAfterGroup: { paddingTop: space.section, borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    minHeight: 60,
  },
  pointer: Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  words: { flex: 1, gap: 2 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  description: { ...type.caption, color: colors.subtle },
  minimum: { ...type.caption, color: colors.subtle },
  summary: { ...type.label, fontVariant: ['tabular-nums'] },
  price: { ...type.value, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, fontWeight: '400', color: colors.subtle },
  add: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: CONTROL / 2 + 2,
    padding: 2,
  },
  stepButton: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: { backgroundColor: colors.bg },
  quantity: { ...type.label, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  footnote: {
    ...type.caption,
    color: colors.subtle,
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.tight,
  },
  empty: { padding: space.section, gap: space.tight },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});
