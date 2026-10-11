/**
 * The object for a kind of work: a real photograph of it, background removed.
 *
 * These used to be SVG drawings made to look like product photos. They are now
 * the photos themselves — the same cut-outs the spotlight storefront uses, one
 * per `SceneKey`, each trimmed, scaled into the same box and stood on the same
 * baseline with the same soft floor shadow. So every place that shows a
 * service (a card, a door, a checkout thumbnail, an order page) shows the same
 * object at the same angle, and a page of them reads as one set.
 *
 * The whole picture is always shown (`contain`): every object touches the foot
 * of its square, so a card can still let it run off the corner, and a door or
 * a well still shows it entire.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { mixTone, type SceneKey, type SceneSurface } from '@/lib/domain/service-scene';
import type { ColorwayKey } from '@/lib/domain/service-look';

import { SERVICE_CUTOUTS } from './service-photo';

export function ServiceScene({
  scene,
  brand,
  surface = 'tile',
}: {
  scene: SceneKey;
  /** The category's colour: it tints the tile behind the object. */
  brand: string;
  /** A coloured tile, or standing on the white of the card. */
  surface?: SceneSurface;
  /** Kept for callers that still pass a sibling's dye; a photograph has its own colours. */
  colorway?: ColorwayKey;
}) {
  const source = SERVICE_CUTOUTS[scene] ?? SERVICE_CUTOUTS.basket;
  return (
    <View
      style={[styles.fill, surface === 'tile' && { backgroundColor: mixTone(brand, 0.86) }]}
      pointerEvents="none"
    >
      <Image source={source} style={styles.fill} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
