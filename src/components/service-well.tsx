/**
 * The well: where a service's own object stands.
 *
 * Three surfaces draw it — the shelf card a customer browses, the tile a
 * counter taps, and the head of the booking screen the card opens into. They
 * drew it three times, which is how the till and the shopfront ended up
 * showing two different pictures of one service. It is one component now, so a
 * change to the ground, the crop, or the corners lands everywhere at once, and
 * so tapping a card and arriving on its booking page reads as the same object
 * carried across rather than as two screens that happen to agree.
 *
 * A photograph of the shop's own work wins the frame whenever there is one;
 * the drawing from `service-scene` is what a service wears until then.
 */
import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceCategory } from '@/lib/domain/service-catalog';

import { ServiceScene } from './service-scene';
import { CROWN, RADII, colors, fontFor, space, type } from './ui-kit';

/** What the well needs to know about a service. */
export interface WelledService {
  name: string;
  category: ServiceCategory;
  /** A photograph of this service, when the shop has uploaded one. */
  image_url?: string | null;
}

export function ServiceWell({
  service,
  height,
  leftLabel,
  rightLabel,
  artStyle,
  ground,
  radius = CROWN.borderTopLeftRadius - 1.5,
  inset = space.snug,
}: {
  service: WelledService;
  /** Set by the surface: a customer browses, a counter taps. */
  height: number;
  /** The well's left corner — what kind of service this is. */
  leftLabel?: string | null;
  /** Its right corner — the shop's rule for counting it, or a count. */
  rightLabel?: string | null;
  /** The lean the surface gives the object when it is touched. */
  artStyle?: Animated.WithAnimatedValue<{ transform?: unknown }> | object;
  /**
   * White unless the surface says otherwise. The till says otherwise: a tile
   * already on the ticket takes the shop's own tone, and the well has to take
   * it too or the selection stops at the foot and the tile reads as half lit.
   */
  ground?: string;
  /** The head corners, matched to the card the well sits in. */
  radius?: number;
  /** Air above a drawing. A photograph fills the well regardless. */
  inset?: number;
}) {
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const tone = showcaseTone(service.category);
  const photo = (service.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;
  const chipGround = hasPhoto ? colors.card : tone.field;

  return (
    <View
      style={[
        styles.well,
        {
          height,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        },
        ground ? { backgroundColor: ground } : null,
      ]}
    >
      <Animated.View
        style={[styles.art, { top: hasPhoto ? 0 : inset }, artStyle as never]}
      >
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
          <ServiceScene
            scene={sceneFor(service.name, service.category)}
            brand={tone.bg}
            surface="white"
          />
        )}
      </Animated.View>

      {/* The shelf label, in the well's two corners.
          The ground decides what a chip has to be. On white it takes the
          category's colour at a whisper, which is the only colour left on the
          card and so the only thing that still sorts wash from dry-cleaning at
          a glance. Over a photograph it goes solid white, because a whisper of
          anything on a photograph is not a chip, it is a smudge. */}
      {leftLabel ? (
        <View style={[styles.chip, styles.chipLeft, { backgroundColor: chipGround }]}>
          <Text style={[styles.chipText, { color: tone.ink }]} numberOfLines={1}>
            {leftLabel}
          </Text>
        </View>
      ) : null}
      {rightLabel ? (
        <View style={[styles.chip, styles.chipRight, { backgroundColor: chipGround }]}>
          <Text style={[styles.chipText, { color: tone.ink }]} numberOfLines={1}>
            {rightLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * White, like the card it heads.
   *
   * The well used to carry the category's colour at a whisper, so a grid could
   * be sorted by tint before a word was read. Six tinted panels in two columns
   * turned out to read as six different cards rather than one shelf, and the
   * objects — which are already in their own colours — had to fight a ground
   * that was never neutral. The card is one white sheet now; the colour that
   * remains is in the corner chips, the rate, and the key.
   *
   * Clipped: a photograph fills the frame, and a drawing may lean past it.
   */
  well: { backgroundColor: colors.card, overflow: 'hidden' },
  art: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  /** The ground is set per instance: a whisper of tint on white, white on a photo. */
  chip: {
    position: 'absolute',
    top: space.snug,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    maxWidth: '58%',
  },
  chipLeft: { left: space.snug },
  chipRight: { right: space.snug },
  chipText: {
    ...type.caption,
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: fontFor(700),
    letterSpacing: 0.3,
  },
});
