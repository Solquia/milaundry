/**
 * One service, shown off.
 *
 * A row says a name and a number. This says what the service *is*: a tile in
 * the colour of its kind with the glyph large on it, the name set as a title,
 * a line about it, and the price where the eye lands last — with the way to
 * book sitting on the tile like a sticker on a shop window. Both the app and
 * the web price list draw this one card, so a shop looks like itself on
 * either.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPriceLine } from '@/lib/domain/price-label';
import { serviceIcon } from '@/lib/domain/service-icon';
import {
  showcaseBlurb,
  showcasePrice,
  showcaseTitle,
  showcaseTone,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';

import { colors, elevation, space, type } from './ui-kit';

export interface ShowcaseCardService extends ShowcaseService {
  name: string;
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

const GLYPH = 38;
const WATERMARK = 96;

export function ServiceShowcaseCard({
  service,
  bookTone,
  onBook,
  isDisabled = false,
}: ServiceShowcaseCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const tone = showcaseTone(service.category);
  const price = showcasePrice(service);
  const icon = serviceIcon(service.name, service.category) as never;
  const isBookable = Boolean(onBook);
  const isLive = isBookable && !isDisabled;

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
          {/* The same glyph, oversized and faint, bleeding off the corner: a
              tile with depth instead of an icon centred in a square. */}
          <Ionicons
            name={icon}
            size={WATERMARK}
            color={tone.ink}
            style={styles.watermark}
            pointerEvents="none"
          />
          <Ionicons name={icon} size={GLYPH} color={tone.ink} />
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  watermark: { position: 'absolute', right: -22, bottom: -24, opacity: 0.14 },
  /** Overlaps the tile's bottom edge, the way a price sticker sits on glass. */
  sticker: {
    marginTop: -16,
    minHeight: 32,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: 'center',
    ...elevation.lift,
  },
  stickerText: { ...type.label, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
});
