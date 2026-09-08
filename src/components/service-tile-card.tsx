/**
 * One service as a card in a grid: the object, its name, its price.
 *
 * Modelled on the shape a services menu takes when it is trying to be looked
 * at rather than read — a white card, the thing itself standing on the page
 * with its own shadow under it, and the words kept small and out of the way.
 * No coloured panel: the object carries the colour, and the card stays white,
 * which is what stops a grid of eight of these reading as eight boxes.
 *
 * Both the app and the web price list draw this, so a shop looks like itself
 * on either. A photograph wins the frame whenever the shop has one.
 */
import { Image } from 'expo-image';
import React from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine } from '@/lib/domain/price-label';
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
   * exists; the diorama is what a service wears until then.
   */
  image_url?: string | null;
}

interface ServiceTileCardProps {
  service: ShowcaseCardService;
  /** The add button's colours — the shop's brand on web, action blue in the app. */
  bookTone: { bg: string; ink: string };
  onBook?: () => void;
  isDisabled?: boolean;
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

export function ServiceTileCard({
  service,
  bookTone,
  onBook,
  isDisabled = false,
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
      damping: 14,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isEngaged, isReduced, lift]);

  const objectStyle = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
    ],
  };

  return (
    <Pressable
      accessibilityRole={isBookable ? 'button' : undefined}
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
      {/* The name sits above the object, the way a shelf is labelled. */}
      <Text style={[styles.name, { color: tone.ink }]} numberOfLines={2}>
        {showcaseTitle(service.name)}
      </Text>

      <View style={styles.stage}>
        <Animated.View style={[styles.object, objectStyle]} pointerEvents="none">
          {hasPhoto ? (
            <Image
              source={{ uri: photo }}
              style={styles.photo}
              contentFit="contain"
              transition={180}
              onError={() => setIsPhotoBroken(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <ServiceScene scene={scene} brand={tone.bg} surface="white" />
          )}
        </Animated.View>
      </View>

      <View style={styles.foot}>
        <Text style={styles.figure} numberOfLines={1}>
          {price.figure}
          {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
        </Text>
        {isBookable ? (
          <View
            style={[
              styles.add,
              { backgroundColor: isDisabled ? colors.borderStrong : bookTone.bg },
            ]}
          >
            <Text style={[styles.addText, { color: isDisabled ? colors.card : bookTone.ink }]}>
              Add
            </Text>
          </View>
        ) : null}
      </View>

      {price.minimum ? <Text style={styles.minimum}>{price.minimum}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: space.room,
    gap: space.snug,
    ...CROWN,
    backgroundColor: colors.card,
    ...elevation.rest,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionDuration: '160ms',
        transitionProperty: 'transform, box-shadow',
      } as object,
      default: {},
    }),
  },
  cardHovered: { ...elevation.lift, transform: [{ translateY: -3 }] },
  cardPressed: { transform: [{ scale: 0.985 }] },

  name: { ...type.label, fontFamily: fontFor(700), lineHeight: 19 },
  /** The object gets the height; the words take what is left. */
  stage: { height: 104, alignItems: 'center', justifyContent: 'center' },
  object: { width: '100%', height: '100%' },
  photo: { width: '100%', height: '100%' },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.snug },
  figure: { ...type.value, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, color: colors.subtle },
  minimum: { ...type.caption, color: colors.subtle, marginTop: -space.tight },
  add: {
    minHeight: 32,
    paddingHorizontal: space.room,
    borderRadius: RADII.pill,
    justifyContent: 'center',
  },
  addText: { ...type.caption, fontFamily: fontFor(700), letterSpacing: 0.3 },
});