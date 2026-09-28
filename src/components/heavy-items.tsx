/**
 * "Anything thick or heavy?" — the booking's optional extras, as a grid of
 * small picture tiles.
 *
 * A list gave every extra a full-width row, and a shop's long names —
 * "Comforter — Extra Thick / Extra Large" — wrapped beside a big Add button
 * until four extras filled the screen. A tile sets the thing large and its
 * variant small, and shows the thing itself the way the services shelf does:
 * the same drawn object (or the shop's own photo) standing in the corner, so
 * a comforter here is the comforter the customer saw on the shelf.
 *
 * Tap a tile to add one; it then floats a − count + over its picture, so
 * three comforters are two more taps. A flat-priced extra counts the same
 * way and is billed once per piece.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  extraArt,
  extraLabel,
  extraLimit,
  extraTilePrice,
  stepExtra,
} from '@/lib/domain/heavy-items';
import { minimumChargeNotice } from '@/lib/domain/price-label';
import { COLORWAYS, serviceLooks, type ServiceLook } from '@/lib/domain/service-look';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';

import { ExtraArt, hasExtraArt } from './extra-art';
import { ServiceScene } from './service-scene';
import { Card, RADII, colors, elevation, fontFor, space, type } from './ui-kit';

/** Every extra is in `looks`; this only satisfies the map's lookup type. */
const FALLBACK_LOOK: ServiceLook = { scene: 'bed', colorway: 'mixed', tag: null };

/** 12% of the tint: the wash behind an added tile. */
const WASH = '1F';

function MiniButton({
  icon,
  label,
  tint,
  isFilled = false,
  isDisabled = false,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  tint: string;
  isFilled?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mini,
        { borderColor: tint },
        isFilled && { backgroundColor: tint },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={16} color={isFilled ? colors.onAccent : tint} />
    </Pressable>
  );
}

/** A service row, plus the photo a shop may have uploaded for it. */
type ExtraService = ServiceRow & { image_url?: string | null };

/** Shelf scenes for the two kinds the shelf already draws. */
const SHELF_SCENES = { curtain: 'curtain', shoe: 'shoes' } as const;

/**
 * The extra itself: the shop's own photo when it has one, else a drawing of
 * that kind of thing — sheets, a comforter, a bear — in the shelf's style.
 */
function TileArt({
  extra,
  look,
  cloth,
}: {
  extra: ExtraService;
  look: ServiceLook;
  /** Set for the second of two extras drawn alike, so they differ in dye. */
  cloth: string | null;
}) {
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const hasPhoto = (extra.image_url ?? '').trim().length > 0 && !isPhotoBroken;
  return (
    <View style={[styles.art, hasPhoto && styles.photo]} pointerEvents="none">
      <HeavyItemArt
        extra={extra}
        look={look}
        cloth={cloth}
        isPhotoBroken={isPhotoBroken}
        onPhotoError={() => setIsPhotoBroken(true)}
      />
    </View>
  );
}

/**
 * The piece itself, filling whatever box it is given: the shop's photo, else
 * its own drawing (a quilted roll, a sack), else the shelf's scene. The market
 * checkout draws its tiles with this too, so a comforter looks the same there.
 */
export function HeavyItemArt({
  extra,
  look,
  cloth,
  isPhotoBroken: brokenFromParent,
  onPhotoError,
}: {
  extra: ExtraService;
  look: ServiceLook;
  cloth: string | null;
  /** For a frame that styles itself by whether the photo loaded; else tracked here. */
  isPhotoBroken?: boolean;
  onPhotoError?: () => void;
}) {
  const art = extraArt(extra.name);
  const [isBrokenHere, setIsBrokenHere] = React.useState(false);
  const isPhotoBroken = brokenFromParent ?? isBrokenHere;
  const setIsPhotoBroken = (_: true) => (onPhotoError ? onPhotoError() : setIsBrokenHere(true));
  const photo = (extra.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;
  return (
    <>
      {hasPhoto ? (
        <Image
          source={{ uri: photo }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setIsPhotoBroken(true)}
          accessibilityIgnoresInvertColors
        />
      ) : hasExtraArt(art) ? (
        <ExtraArt art={art} cloth={cloth} uid={extra.id} />
      ) : (
        <ServiceScene
          scene={SHELF_SCENES[art]}
          colorway={look.colorway}
          brand={showcaseTone(extra.category).bg}
          surface="white"
        />
      )}
    </>
  );
}

/**
 * The dye each extra is drawn in. The first of each kind keeps the drawing's
 * own colours; a second one drawn alike wears its colorway, so two comforters
 * are two colours.
 */
export function extraCloths(
  extras: readonly Pick<ExtraService, 'id' | 'name'>[],
  looks: ReadonlyMap<string, ServiceLook>
): Map<string, string | null> {
  const seen = new Set<string>();
  return new Map(
    extras.map((extra) => {
      const art = extraArt(extra.name);
      const colorway = looks.get(extra.id)?.colorway ?? 'mixed';
      const isRepeat = seen.has(art);
      seen.add(art);
      const dye = isRepeat && colorway !== 'mixed' ? COLORWAYS[colorway].cloth : null;
      return [extra.id, dye] as const;
    })
  );
}

function ExtraTile({
  extra,
  look,
  cloth,
  quantity,
  tint,
  onChange,
}: {
  extra: ServiceRow;
  look: ServiceLook;
  cloth: string | null;
  quantity: number;
  tint: string;
  onChange: (next: number) => void;
}) {
  const { title, variant } = extraLabel(extra.name);
  const isAdded = quantity > 0;
  const price = extraTilePrice(extra, quantity);
  const unit = extra.unit === 'per_kg' ? ' kg' : '';
  const notice = minimumChargeNotice(extra, quantity);
  const add = () => onChange(stepExtra(extra.unit, quantity, 1));
  const spoken = [title, variant, price, isAdded ? `${quantity}${unit} added` : null, notice]
    .filter(Boolean)
    .join(', ');

  const names = (
    <View style={styles.names}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {variant ? (
        <Text style={styles.variant} numberOfLines={1}>
          {variant}
        </Text>
      ) : null}
    </View>
  );

  // Once added, the tile is a plain card and its − and + are the buttons. It
  // used to stay a *disabled* Pressable: on the web that renders as
  // <button disabled>, and a browser swallows every click inside one, so the
  // stepper was dead after the first add.
  if (isAdded) {
    return (
      <View
        accessibilityLabel={spoken}
        style={[styles.tile, { borderColor: tint, backgroundColor: `${tint}${WASH}` }]}
      >
        <TileArt extra={extra} look={look} cloth={cloth} />
        <View style={styles.head}>{names}</View>
        <View style={styles.foot}>
          <View style={styles.pricePill}>
            <Text style={[styles.price, { color: tint }]}>{price}</Text>
          </View>
          <View style={styles.stepper}>
            <MiniButton
              icon="remove"
              label={`One less ${title}`}
              tint={tint}
              onPress={() => onChange(stepExtra(extra.unit, quantity, -1))}
            />
            <Text style={styles.count} accessibilityLiveRegion="polite">
              {quantity}
              {unit}
            </Text>
            <MiniButton
              icon="add"
              label={`One more ${title}`}
              tint={tint}
              isFilled
              isDisabled={quantity >= extraLimit(extra.unit)}
              onPress={add}
            />
          </View>
        </View>
      </View>
    );
  }

  // Not added yet: the whole tile is the add button, and its + is only a
  // picture of one — a button nested in a button is not valid on the web.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={add}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <TileArt extra={extra} look={look} cloth={cloth} />
      <View style={styles.head}>
        {names}
        <View style={[styles.mini, { borderColor: tint, backgroundColor: tint }]}>
          <Ionicons name="add" size={16} color={colors.onAccent} />
        </View>
      </View>
      <View style={styles.foot}>
        <View style={styles.pricePill}>
          <Text style={styles.price}>{price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function HeavyItems({
  extras,
  quantities,
  onChange,
  isBare = false,
  tint = colors.action,
}: {
  extras: readonly ServiceRow[];
  quantities: Readonly<Record<string, number>>;
  onChange: (serviceId: string, next: number) => void;
  /** Just the tiles, for a surface that brings its own card and heading. */
  isBare?: boolean;
  /** The colour an added tile lights up in. */
  tint?: string;
}) {
  // Siblings on the same drawing get different dyes, exactly as on the shelf.
  const looks = React.useMemo(() => serviceLooks(extras), [extras]);
  // The first extra of each kind keeps the drawing's own colours; a second
  // one drawn alike wears its colorway, so two comforters are two colours.
  const cloths = React.useMemo(() => extraCloths(extras, looks), [extras, looks]);
  if (extras.length === 0) return null;

  const grid = (
    <View style={styles.grid}>
      {extras.map((extra) => (
        <ExtraTile
          key={extra.id}
          extra={extra}
          look={looks.get(extra.id) ?? FALLBACK_LOOK}
          cloth={cloths.get(extra.id) ?? null}
          quantity={quantities[extra.id] ?? 0}
          tint={tint}
          onChange={(next) => onChange(extra.id, next)}
        />
      ))}
    </View>
  );
  if (isBare) return grid;

  return (
    <Card>
      <View style={styles.intro}>
        <Text style={styles.heading}>Anything thick or heavy?</Text>
        <Text style={styles.subheading}>Priced separately. Skip if you have none.</Text>
      </View>
      {grid}
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 2 },
  heading: { ...type.section, color: colors.text },
  subheading: { ...type.caption, color: colors.subtle },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  // Two to a row at any phone width; a lone last tile keeps the same width.
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '50%',
    minHeight: 150,
    justifyContent: 'space-between',
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  // The object stands in the lower right and runs off the corner, as on the shelf.
  art: { position: 'absolute', right: -10, bottom: -10, width: '62%', aspectRatio: 1 },
  photo: { borderTopLeftRadius: RADII.control, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.tight },
  names: { flex: 1, minWidth: 0 },
  title: { ...type.label, fontSize: 15, lineHeight: 19, color: colors.text },
  variant: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.subtle },
  foot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  // White behind the figures so they stay legible over the drawing.
  pricePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
  },
  price: { ...type.label, fontFamily: fontFor(700), color: colors.text },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 3,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  mini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  count: { ...type.label, fontFamily: fontFor(700), minWidth: 16, textAlign: 'center', color: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
