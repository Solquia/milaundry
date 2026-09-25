/**
 * One service on the shelf, drawn as the front of a machine.
 *
 * The card used to be a white sheet with the object standing in a well across
 * its top — clean, but the same card any shop app draws around any product.
 * A laundry sells what goes through its machines, so the card is a small
 * front-loader now: a control strip across the head with the service's kind on
 * it and a status light, the door in the middle with the object behind the
 * glass (`service-porthole.tsx`), and the name and rate on the panel below.
 *
 * The category's colour lives in three places and nowhere else: the water in
 * the door, the rate's pill, and the light once a finger is on the card. That
 * is enough to sort wash from dry-cleaning across a grid of six without turning
 * it into six differently coloured panels. There is no turnaround field, so
 * nothing here promises a time; the shop's own minimum rides with the rate.
 *
 * The card is the button in every mode. Pass `quantity` and the stepper takes
 * the key's place in the foot, and the door's display shows what is held.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine, formatQuantity } from '@/lib/domain/price-label';
import { portholeLevel } from '@/lib/domain/porthole';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { shelfPill } from '@/lib/domain/service-shelf';
import {
  showcasePrice,
  showcaseTitle,
  showcaseTone,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';

import { ServicePorthole } from './service-porthole';
import { CROWN, RADII, colors, elevation, fontFor, space, type } from './ui-kit';

export interface ShowcaseCardService extends ShowcaseService {
  name: string;
  /**
   * A photograph of this service, when the shop has one. A picture of the
   * shop's own work beats any drawing, so it wins the door whenever it
   * exists; the drawing is what a service wears until then.
   */
  image_url?: string | null;
}

interface ServiceTileCardProps {
  service: ShowcaseCardService;
  /** The stepper's colours — the shop's brand on web, action blue in the app. */
  bookTone: { bg: string; ink: string };
  /** Opens the booking page for this service. Absent when bookings are closed. */
  onBook?: () => void;
  /** Shown but not bookable yet — the app before the customer has connected. */
  isDisabled?: boolean;
  /** The category, printed on the machine's control strip. */
  categoryLabel?: string;
  /** Basket mode: the card carries − and + and shows what is on the ticket. */
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
}

/** The door's diameter: the object is a picture at this size, not a glyph. */
const DOOR_SIZE = 104;

function Step({
  label,
  hint,
  onPress,
  ink,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  ink: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <Text style={[styles.stepText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

export function ServiceTileCard({
  service,
  bookTone,
  onBook,
  categoryLabel,
  isDisabled = false,
  quantity,
  onAdd,
  onRemove,
}: ServiceTileCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  const isReduced = useReducedMotion();

  const tone = showcaseTone(service.category);
  const price = showcasePrice(service);
  const pill = shelfPill(service);
  const title = showcaseTitle(service.name);

  const isBasket = quantity !== undefined;
  const held = quantity ?? 0;
  const isBookable = (isBasket ? held === 0 : Boolean(onBook)) && !isDisabled;
  const isEngaged = isBookable && (isHovered || isPressed);
  const isLit = isEngaged || held > 0;

  const [lift] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (isReduced) {
      lift.setValue(0);
      return;
    }
    Animated.spring(lift, {
      toValue: isEngaged ? 1 : 0,
      damping: 12,
      stiffness: 170,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isEngaged, isReduced, lift]);

  /** The key leans the way it will take you: up and to the right, a nudge. */
  const keyStyle = {
    transform: [
      { translateX: lift.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
    ],
  };

  /**
   * The card is the button. The round key is a cue drawn on it, not a second
   * target — which is what keeps this a single tap area and, on the web, a
   * single <button> rather than one nested in another.
   */
  const cardPress = isBasket ? (held === 0 ? onAdd : undefined) : onBook;
  const Wrapper = cardPress ? Pressable : View;
  const pressProps = cardPress
    ? {
        accessibilityRole: 'button' as const,
        // The minimum is deliberately not read twice: `formatPriceLine` already
        // carries the unit and the minimum the rate line shows.
        accessibilityLabel: [
          isBasket ? `Add ${title}` : `Book ${title}`,
          categoryLabel,
          formatPriceLine(service),
        ]
          .filter(Boolean)
          .join('. '),
        accessibilityHint: isBasket ? undefined : 'Opens booking for this service',
        accessibilityState: { disabled: isDisabled },
        disabled: isDisabled,
        onPress: cardPress,
        onPressIn: () => setIsPressed(true),
        onPressOut: () => setIsPressed(false),
      }
    : {};

  const readout =
    held > 0 ? (service.unit === 'flat' ? 'Added' : formatQuantity(service.unit, held)) : null;

  return (
    <Wrapper
      {...pressProps}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      // An array, never a function: a plain View silently ignores a function
      // style, which once dropped every card style and collapsed the grid.
      style={[
        styles.card,
        isHovered && isBookable && styles.cardHovered,
        isPressed && isBookable && styles.cardPressed,
        held > 0 && { borderColor: bookTone.bg },
      ]}
    >
      {/* The control strip: what kind of wash this is, and a status light that
          comes on under a finger — the machine answering the touch. */}
      <View style={styles.panel}>
        <Text style={[styles.panelLabel, { color: tone.ink }]} numberOfLines={1}>
          {categoryLabel ?? ''}
        </Text>
        <View style={styles.controls}>
          <View style={styles.dial}>
            <View style={styles.dialTick} />
          </View>
          <View style={[styles.light, isLit && { backgroundColor: tone.bg, borderColor: tone.bg }]} />
        </View>
      </View>

      <View style={styles.door}>
        <ServicePorthole
          service={service}
          size={DOOR_SIZE}
          level={portholeLevel(service.unit, held)}
          waterTint={held > 0 ? bookTone.bg : tone.bg}
          lift={lift}
          tumbleKey={held}
          readout={readout}
        />
      </View>

      {/* The panel below the door: the name first, then the rate. */}
      <View style={styles.foot}>
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.rateRow}>
          <View style={styles.words}>
            <View style={[styles.ratePill, { backgroundColor: tone.field }]}>
              <Text style={[styles.rate, { color: tone.ink }]} numberOfLines={1}>
                <Text style={styles.peso}>{price.symbol}</Text>
                {price.amount}
                {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
              </Text>
            </View>
            {/* The shop's minimum rides with the rate it modifies: the one fact
                the figure cannot carry, and the one a customer is caught by. */}
            {pill.kind === 'rule' ? (
              <Text style={styles.rule} numberOfLines={1}>
                {pill.text}
              </Text>
            ) : null}
          </View>

          {isBasket && held > 0 ? (
            <View style={[styles.stepper, { borderColor: bookTone.bg }]}>
              <Step label="−" hint={`Remove ${title}`} onPress={() => onRemove?.()} ink={bookTone.bg} />
              {service.unit === 'flat' ? null : (
                <Step label="+" hint={`Add more ${title}`} onPress={() => onAdd?.()} ink={bookTone.bg} />
              )}
            </View>
          ) : isBookable ? (
            <Animated.View
              style={[styles.key, keyStyle, isEngaged && { backgroundColor: tone.ink }]}
            >
              <Ionicons
                name="arrow-forward"
                size={17}
                color={isEngaged ? colors.onAccent : colors.text}
                style={styles.keyGlyph}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.rest,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionDuration: '180ms',
        transitionProperty: 'transform, box-shadow, border-color',
      } as object,
      default: {},
    }),
  },
  cardHovered: { ...elevation.lift, transform: [{ translateY: -3 }] },
  cardPressed: { transform: [{ scale: 0.985 }] },

  /**
   * The machine's control strip: recessed a step from the white, one hairline
   * under it, the way a panel meets a door.
   */
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    height: 30,
    paddingHorizontal: space.cosy,
    backgroundColor: colors.sunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelLabel: {
    flex: 1,
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFor(800),
    letterSpacing: 0.2,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** A dial, drawn: a ring with one tick, set to where it always is. */
  dial: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  dialTick: { width: 1.5, height: 4, marginTop: 1, borderRadius: 1, backgroundColor: colors.subtle },
  light: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.border,
  },

  door: { alignItems: 'center', paddingTop: space.room, paddingBottom: space.snug },

  foot: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingBottom: space.cosy,
    paddingTop: space.tight,
  },
  /** The name is the largest thing on the card: it answers the first question. */
  name: { ...type.label, fontFamily: fontFor(800), fontSize: 16, lineHeight: 20, color: colors.text },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  words: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  ratePill: {
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  rate: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fontFor(800),
    fontVariant: ['tabular-nums'],
  },
  /**
   * The currency mark, set down rather than matched to the digits. Figtree has
   * no peso glyph, so the platform substitutes another face; at full weight
   * that substitution reads as a mistake rather than as a mark.
   */
  peso: { fontFamily: fontFor(600), fontSize: 11.5 },
  unit: { fontFamily: fontFor(600), fontSize: 11.5 },
  /** The rule, set down and greyed: it qualifies the rate, it is not the rate. */
  rule: { ...type.caption, fontSize: 11.5, lineHeight: 15, fontFamily: fontFor(600), color: colors.subtle },

  /**
   * The way in: a round key on the panel, quiet until a finger is on the card,
   * then filled with the category's ink (deep enough for a white glyph, where
   * the yellow of self-service is not) — the card's one authored moment,
   * shared with the light on the strip.
   */
  key: {
    pointerEvents: 'none',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  /** Forward, turned up: where the card is about to take you. */
  keyGlyph: { transform: [{ rotate: '-45deg' }] },

  /** The key's place in the foot, once something is on the ticket. */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...type.section, fontSize: 18 },
  pressed: { opacity: 0.6 },
});
