/**
 * One service, shown off.
 *
 * A row says a name and a number. This says what the service *is*: a small
 * diorama of the thing itself, lit from one corner and standing on its own
 * shadow, the name set as a title, a line about it, and the price where the
 * eye lands last — with the way to book sitting on the scene like a sticker on
 * a shop window. Both the app and the web price list draw this one card, so a
 * shop looks like itself on either.
 *
 * The scene lifts and settles when the card is touched or hovered. It is the
 * only authored motion on the list, it runs on a spring rather than a curve so
 * the object has weight, and it does not run at all for anyone who has asked
 * their device for less motion.
 */
import { Image } from 'expo-image';
import React from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine } from '@/lib/domain/price-label';
import { sceneFor } from '@/lib/domain/service-scene';
import {
  showcaseBlurb,
  showcasePrice,
  showcaseTitle,
  showcaseTone,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';

import { ServiceScene } from './service-scene';
import { CROWN, RADII, colors, elevation, space, type } from './ui-kit';

export interface ShowcaseCardService extends ShowcaseService {
  name: string;
  /**
   * A photograph of this service, when the shop has one. A picture of the
   * shop's own work beats any drawing, so it wins the tile whenever it
   * exists; the diorama is what a service wears until then.
   */
  image_url?: string | null;
}

interface ServiceShowcaseCardProps {
  service: ShowcaseCardService;
  /** The book sticker's colours — the shop's brand on web, the app's action blue. */
  bookTone: { bg: string; ink: string };
  /** Books this service; absent when the shop is not taking bookings. */
  onBook?: () => void;
  /** Shown but not bookable yet — the app before the customer has connected. */
  isDisabled?: boolean;
}

/** Whether the device has asked for less motion. Read once, then watched. */
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

export function ServiceShowcaseCard({
  service,
  bookTone,
  onBook,
  isDisabled = false,
}: ServiceShowcaseCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  const isReduced = useReducedMotion();
  const tone = showcaseTone(service.category);
  const price = showcasePrice(service);
  const scene = sceneFor(service.name, service.category);
  const photo = (service.image_url ?? '').trim();
  // A URL that fails to load must not leave a coloured hole where the picture
  // was, so a broken photo falls back to the drawing rather than to nothing.
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const hasPhoto = photo.length > 0 && !isPhotoBroken;
  const isBookable = Boolean(onBook);
  const isLive = isBookable && !isDisabled;
  const isEngaged = isLive && (isHovered || isPressed);

  const [lift] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (isReduced) {
      lift.setValue(0);
      return;
    }
    Animated.spring(lift, {
      toValue: isEngaged ? 1 : 0,
      // Enough damping that it settles rather than wobbles, and enough mass
      // that the object reads as solid rather than as a bouncing sprite.
      damping: 14,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isEngaged, isReduced, lift]);

  const sceneStyle = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };

  return (
    <Pressable
      accessibilityRole={isBookable ? 'button' : undefined}
      // The spoken label keeps centavos: a screen reader gains nothing from
      // the compact figure that makes the card scannable.
      accessibilityLabel={
        isBookable ? `Book ${showcaseTitle(service.name)}. ${formatPriceLine(service)}` : undefined
      }
      accessibilityState={isBookable ? { disabled: isDisabled } : undefined}
      disabled={!isBookable}
      onPress={onBook}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={({ pressed }) => [
        styles.card,
        isLive && isHovered && styles.cardHovered,
        pressed && isBookable && styles.cardPressed,
      ]}
    >
      <View style={styles.words}>
        <Text style={[styles.title, { color: tone.ink }]} numberOfLines={2}>
          {showcaseTitle(service.name)}
        </Text>
        <Text style={styles.blurb} numberOfLines={3}>
          {showcaseBlurb(service)}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.figure}>
            {price.figure}
            {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
          </Text>
          {price.minimum ? <Text style={styles.minimum}>{price.minimum}</Text> : null}
        </View>
      </View>

      <View style={styles.tileColumn}>
        <View style={[styles.tile, { backgroundColor: tone.bg }]}>
          <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents="none">
            {hasPhoto ? (
              <Image
                source={{ uri: photo }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={180}
                onError={() => setIsPhotoBroken(true)}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <ServiceScene scene={scene} brand={tone.bg} />
            )}
          </Animated.View>
        </View>
        {isBookable ? (
          <View
            style={[
              styles.sticker,
              { backgroundColor: isDisabled ? colors.borderStrong : bookTone.bg },
            ]}
          >
            <Text style={[styles.stickerText, { color: isDisabled ? colors.card : bookTone.ink }]}>
              Book
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.room,
    padding: space.room,
    ...CROWN,
    backgroundColor: colors.card,
    ...elevation.rest,
    ...Platform.select({
      web: { cursor: 'pointer', transitionDuration: '160ms', transitionProperty: 'transform, box-shadow' } as object,
      default: {},
    }),
  },
  cardHovered: { ...elevation.lift, transform: [{ translateY: -2 }] },
  cardPressed: { transform: [{ scale: 0.985 }] },

  words: { flex: 1, justifyContent: 'space-between', gap: space.snug },
  title: { ...type.section, fontSize: 19, lineHeight: 24 },
  blurb: { ...type.body, fontSize: 14, lineHeight: 20, color: colors.subtle },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.snug },
  figure: { ...type.value, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, fontSize: 13, fontWeight: '500', color: colors.subtle },
  minimum: { ...type.caption, color: colors.subtle },

  tileColumn: { alignItems: 'center', width: 104 },
  tile: {
    width: 104,
    height: 104,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Overlaps the tile's bottom edge, the way a price sticker sits on glass. */
  sticker: {
    marginTop: -16,
    minHeight: 36,
    paddingHorizontal: 18,
    borderRadius: RADII.pill,
    justifyContent: 'center',
    // A white rim, so the sticker reads as its own thing on a tile of any
    // colour, including one close to the sticker's own.
    borderWidth: 2.5,
    borderColor: colors.card,
    ...elevation.lift,
  },
  stickerText: { ...type.label, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
});