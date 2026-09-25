/**
 * One service on the shop's menu, as a row.
 *
 * The shelf used to draw every service as a washing-machine front — a chrome
 * door with a drawing behind the glass. It was a laundry's metaphor, not a
 * customer's: ironing and dry-cleaning never go through a washer, the door
 * took half the card to say the name a third time, and a phone held four
 * services a screen. A customer choosing a service reads a menu, so this is a
 * menu line: what it is, a word about it, and what it costs, with the shop's
 * minimum sitting under the price it changes.
 *
 * Colour is left to the shop: the only tint on the row is the hover ground,
 * and the price is set in ink rather than in a category's hue.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine } from '@/lib/domain/price-label';
import type { ServiceCategory } from '@/lib/domain/service-catalog';
import { shelfPill } from '@/lib/domain/service-shelf';
import {
  showcaseBlurb,
  showcasePrice,
  showcaseTitle,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';

import { colors, fontFor, space, type } from './ui-kit';

export interface ServiceRowService extends ShowcaseService {
  name: string;
  /** The shop's own photo of this service; it takes the icon's place. */
  image_url?: string | null;
}

/** A line icon per category — one weight, one ink, so the list stays quiet. */
const CATEGORY_GLYPHS: Record<
  ServiceCategory,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  wash_fold: 'tshirt-crew-outline',
  ironing: 'iron-outline',
  dry_cleaning: 'hanger',
  special_items: 'bed-outline',
  self_service: 'washing-machine',
  other: 'basket-outline',
};

const THUMB = 44;

interface ServiceRowProps {
  service: ServiceRowService;
  /** Opens booking for this service. Absent when the shop is not taking bookings. */
  onBook?: () => void;
  /** Listed but not bookable yet — the app before the customer has connected. */
  isDisabled?: boolean;
}

export function ServiceRow({ service, onBook, isDisabled = false }: ServiceRowProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);

  const title = showcaseTitle(service.name);
  const price = showcasePrice(service);
  const pill = shelfPill(service);
  const photo = (service.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;
  const isBookable = Boolean(onBook) && !isDisabled;

  return (
    <Pressable
      accessibilityRole={onBook ? 'button' : undefined}
      accessibilityLabel={[title, formatPriceLine(service)].join('. ')}
      accessibilityHint={isBookable ? 'Opens booking for this service' : undefined}
      accessibilityState={{ disabled: !isBookable }}
      disabled={!isBookable}
      onPress={onBook}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={({ pressed }) => [
        styles.row,
        isBookable && isHovered && styles.hovered,
        isBookable && pressed && styles.pressed,
      ]}
    >
      <View style={styles.thumb}>
        {hasPhoto ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            contentFit="cover"
            accessible={false}
            onError={() => setIsPhotoBroken(true)}
          />
        ) : (
          <MaterialCommunityIcons
            name={CATEGORY_GLYPHS[service.category] ?? CATEGORY_GLYPHS.other}
            size={22}
            color={colors.subtle}
          />
        )}
      </View>

      <View style={styles.words}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.blurb} numberOfLines={2}>
          {showcaseBlurb(service)}
        </Text>
      </View>

      <View style={styles.cost}>
        <Text style={styles.price} numberOfLines={1}>
          <Text style={styles.peso}>{price.symbol}</Text>
          {price.amount}
          {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
        </Text>
        {pill.kind === 'rule' ? (
          <Text style={styles.minimum} numberOfLines={1}>
            {pill.text}
          </Text>
        ) : null}
      </View>

      {isBookable ? (
        <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    minHeight: 72,
    paddingVertical: space.cosy,
    paddingHorizontal: space.room,
    backgroundColor: colors.card,
    ...Platform.select({
      web: { cursor: 'pointer', transitionDuration: '140ms', transitionProperty: 'background-color' } as object,
      default: {},
    }),
  },
  hovered: { backgroundColor: colors.sunken },
  pressed: { backgroundColor: colors.sunken, opacity: 0.85 },

  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: THUMB, height: THUMB },

  words: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.label, fontFamily: fontFor(700), fontSize: 16, lineHeight: 21, color: colors.text },
  blurb: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.subtle },

  /** The price, right-aligned so a column of them can be compared at a glance. */
  cost: { alignItems: 'flex-end', gap: 2, maxWidth: '38%' },
  price: {
    fontFamily: fontFor(800),
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  /** Figtree has no peso glyph; set down, the substitute reads as a mark, not a mistake. */
  peso: { fontFamily: fontFor(600), fontSize: 14 },
  unit: { fontFamily: fontFor(600), fontSize: 13, color: colors.subtle },
  /** The minimum sits under the rate it changes — the one a customer is caught by. */
  minimum: { ...type.caption, fontSize: 12, lineHeight: 16, fontFamily: fontFor(600), color: colors.moneyOut },
});
