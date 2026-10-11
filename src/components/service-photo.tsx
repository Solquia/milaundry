/**
 * A product shot of the work, for the spotlight storefront and its checkout.
 *
 * The other looks draw each service; this one shows it, the way McDonald's
 * shows a burger: one cut-out per kind of work (the `SceneKey` a service's
 * name already resolves to), its background removed, so the object stands
 * on whatever tint the card gives it.
 *
 * The set was made to be one set: every object is trimmed to its own edges,
 * scaled into the same box, centred, and stood on the same baseline with the
 * same soft floor shadow, on identical transparent 640×640 canvases. That is
 * why the whole of each picture is always shown (`contain`), never cropped —
 * a crop would knock one object off the line the others stand on.
 *
 * Cut from Unsplash photos (Unsplash License); the photographers are credited
 * in assets/images/services/CREDITS.md.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { BannerPhoto } from '@/lib/domain/spotlight';

/** The cut-out for each kind of work, for any card that shows the object on its own. */
export const SERVICE_CUTOUTS: Record<BannerPhoto, number> = {
  stack: require('../../assets/images/services/stack.webp'),
  iron: require('../../assets/images/services/iron.webp'),
  suit: require('../../assets/images/services/suit.webp'),
  bed: require('../../assets/images/services/bed.webp'),
  machine: require('../../assets/images/services/machine.webp'),
  basket: require('../../assets/images/services/basket.webp'),
  shoes: require('../../assets/images/services/shoes.webp'),
  curtain: require('../../assets/images/services/curtain.webp'),
  sofa: require('../../assets/images/services/sofa.webp'),
};

interface ServicePhotoProps {
  photo: BannerPhoto;
  /**
   * The shop's own photo of this service (0042). An owner's photo is a whole
   * picture, not a cut-out, so it fills the well edge to edge instead.
   */
  uri?: string | null;
  /** The well: its size, corners and tint. The cut-out sits inside it, whole. */
  style?: StyleProp<ViewStyle>;
  /** Breathing room between the object and the well's edge, in points. */
  inset?: number;
}

/** Decorative: the name beside it already says what it is, so a reader skips it. */
export function ServicePhoto({ photo, uri, style, inset = 0 }: ServicePhotoProps) {
  return (
    <View style={[styles.well, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image
          source={{ uri }}
          // Our cut-out stands in while the shop's photo loads, and if it never does.
          placeholder={SERVICE_CUTOUTS[photo]}
          placeholderContentFit="contain"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <Image
          source={SERVICE_CUTOUTS[photo]}
          style={[StyleSheet.absoluteFill, { margin: inset }]}
          contentFit="contain"
          transition={180}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { overflow: 'hidden' },
});
