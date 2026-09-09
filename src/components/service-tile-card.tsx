/**
 * One service as a card: what it is, what it costs, and the thing itself.
 *
 * The words sit top-left and the object bottom-right, big enough to be looked
 * at rather than referred to. That split is what makes a grid of these
 * scannable — every name starts in the same place, so a column reads like a
 * list, while the objects fill the space the words do not need.
 *
 * The card stays white. Colour on it would compete with the object, which is
 * the one thing on the card worth looking at; the name in the category's ink
 * and the object's own palette carry all the colour this needs.
 *
 * The same card serves the price list and the ordering step. Pass `quantity`
 * and the steppers and it becomes a basket row. The card itself is the button
 * in both, which is why there is no Add on it.
 */
import { Image } from 'expo-image';
import React from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine, formatQuantity } from '@/lib/domain/price-label';
import { sceneFor } from '@/lib/domain/service-scene';
import {
  showcasePrice,
  showcaseTitle,
  showcaseTone,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';

import { ServiceScene } from './service-scene';
import { CROWN, RADII, colors, elevation, fontFor, space, type } from './ui-kit';

export interface ShowcaseCardService extends ShowcaseService {
  name: string;
  /**
   * A photograph of this service, when the shop has one. A picture of the
   * shop's own work beats any drawing, so it wins the frame whenever it
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
  /**
   * The category, worn in the card's own corner. Given one, the list above no
   * longer needs a heading per group, which is what let the cards close up.
   */
  categoryLabel?: string;
  /** Basket mode: the card carries − and + and shows what is on the ticket. */
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
}

/** Whether the device has asked for less motion. */
function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setIsReduced(value);
    });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReduced);
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  return isReduced;
}

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
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const isReduced = useReducedMotion();

  const tone = showcaseTone(service.category);
  const price = showcasePrice(service);
  const scene = sceneFor(service.name, service.category);
  const photo = (service.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;

  const isBasket = quantity !== undefined;
  const held = quantity ?? 0;
  const isBookable = (isBasket ? held === 0 : Boolean(onBook)) && !isDisabled;
  const isEngaged = isBookable && (isHovered || isPressed);

  const [lift] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (isReduced) {
      lift.setValue(0);
      return;
    }
    Animated.spring(lift, {
      toValue: isEngaged ? 1 : 0,
      damping: 14,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isEngaged, isReduced, lift]);

  const objectStyle = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
    ],
  };

  /**
   * The card is the button, which is why there is no Add on it. In basket mode
   * that holds only until something is on the ticket: once the steppers appear
   * a card-wide press would fight them, so the card goes inert.
   */
  const cardPress = isBasket ? (held === 0 ? onAdd : undefined) : onBook;
  const Wrapper = cardPress ? Pressable : View;
  const pressProps = cardPress
    ? {
        accessibilityRole: 'button' as const,
        accessibilityLabel: isBasket
          ? `Add ${showcaseTitle(service.name)}. ${formatPriceLine(service)}`
          : `Book ${showcaseTitle(service.name)}. ${formatPriceLine(service)}`,
        accessibilityState: { disabled: isDisabled },
        disabled: isDisabled,
        onPress: cardPress,
        onPressIn: () => setIsPressed(true),
        onPressOut: () => setIsPressed(false),
      }
    : {};

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
      {/* Drawn before the words so they sit over it, and ignored by touch so
          it never eats a stepper press. */}
      <Animated.View style={[styles.object, objectStyle]} pointerEvents="none">
        {hasPhoto ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={180}
            onError={() => setIsPhotoBroken(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ServiceScene scene={scene} brand={tone.bg} surface="white" />
        )}
      </Animated.View>

      {categoryLabel ? (
        <View style={styles.tag}>
          <Text style={[styles.tagText, { color: tone.ink }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>
      ) : null}

      <View style={[styles.words, categoryLabel ? styles.wordsUnderTag : null]}>
        <Text style={[styles.name, { color: tone.ink }]} numberOfLines={2}>
          {showcaseTitle(service.name)}
        </Text>
        <Text style={styles.figure} numberOfLines={1}>
          <Text style={styles.peso}>{price.symbol}</Text>
          {price.amount}
          {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
        </Text>
        {price.minimum ? (
          <View style={styles.minimum}>
            <Text style={[styles.minimumText, { color: tone.ink }]} numberOfLines={1}>
              {price.minimum}
            </Text>
          </View>
        ) : null}
      </View>

      {isBasket && held > 0 ? (
        <View style={[styles.stepper, { borderColor: bookTone.bg }]}>
          <Step
            label="−"
            hint={`Remove ${showcaseTitle(service.name)}`}
            onPress={() => onRemove?.()}
            ink={bookTone.bg}
          />
          <Text style={styles.held} numberOfLines={1}>
            {service.unit === 'flat' ? 'Added' : formatQuantity(service.unit, held)}
          </Text>
          {service.unit === 'flat' ? null : (
            <Step
              label="+"
              hint={`Add more ${showcaseTitle(service.name)}`}
              onPress={() => onAdd?.()}
              ink={bookTone.bg}
            />
          )}
        </View>
      ) : null}
    </Wrapper>
  );
}

const CARD_HEIGHT = 182;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    height: CARD_HEIGHT,
    padding: space.room,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    ...elevation.rest,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionDuration: '180ms',
        transitionProperty: 'transform, box-shadow',
      } as object,
      default: {},
    }),
  },
  cardHovered: { ...elevation.lift, transform: [{ translateY: -4 }] },
  cardPressed: { transform: [{ scale: 0.985 }] },

  /**
   * Anchored to the bottom-right corner and allowed to run past it. Big enough
   * to be the thing you look at; the card clips whatever overruns.
   */
  object: { position: 'absolute', right: -12, bottom: -14, width: 150, height: 150 },

  words: { gap: 2, alignItems: 'flex-start' },
  /** Clears the tag, so a long name wraps instead of running under it. */
  wordsUnderTag: { paddingTop: 22 },
  /**
   * The category, top-right. Not an eyebrow over the name — it is a tag in the
   * card's own corner, which is where a shelf label goes and where nothing
   * else on this card wants to be.
   */
  tag: {
    position: 'absolute',
    top: space.cosy,
    right: space.cosy,
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
    maxWidth: '62%',
  },
  tagText: { ...type.caption, fontSize: 10.5, fontFamily: fontFor(700), letterSpacing: 0.3 },
  name: { ...type.label, fontFamily: fontFor(800), fontSize: 15, lineHeight: 19 },
  /** The figure is the reason the card exists, so it is the largest thing on it. */
  figure: {
    ...type.value,
    fontFamily: fontFor(800),
    fontSize: 25,
    letterSpacing: -0.7,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  /**
   * The currency mark, set down rather than matched to the digits. Figtree has
   * no peso glyph, so the platform substitutes another face; at full size and
   * weight that substitution reads as a mistake. Smaller and quieter it reads
   * as a deliberate mark, and the number keeps the emphasis it deserves.
   */
  peso: {
    fontFamily: fontFor(600),
    fontSize: 16,
    letterSpacing: 0,
    color: colors.subtle,
  },
  unit: { ...type.caption, fontFamily: fontFor(600), color: colors.subtle },
  /**
   * The shop's rule, said as a chip rather than as small print. The card is
   * white, so the chip takes the sunken tone to read as a chip at all, and
   * the category's ink to say which service it belongs to.
   */
  minimum: {
    marginTop: 4,
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
  },
  minimumText: { ...type.caption, fontSize: 11, fontFamily: fontFor(600) },

  /** Bottom-left, clear of the object's corner. */
  stepper: {
    position: 'absolute',
    left: space.room,
    bottom: space.room,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...type.section, fontSize: 18 },
  held: { ...type.caption, fontFamily: fontFor(700), color: colors.text, minWidth: 44, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});