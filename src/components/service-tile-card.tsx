/**
 * One service on the shelf, laid out like a laundry's price board.
 *
 * The board every customer already knows: a white tile, the service's name
 * large at the top left, and the thing itself — a folded pile, an iron, a
 * garment bag — standing big in the lower right and running off the corner,
 * the way a cut-out product photograph does. The object is the picture and
 * the name is the headline; the rate sits quietly at the foot, where the eye
 * lands last.
 *
 * The category's colour is kept to the rate's pill, so a grid of six stays a
 * grid of white tiles with six different things in it. A photograph of the
 * shop's own work, when there is one, takes the object's place.
 *
 * The card is the button in every mode. Pass `quantity` and a stepper takes
 * the rate's place, and the amount on the ticket shows at the top right.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { tileBadge } from '@/lib/domain/pos-ticket';
import { formatPriceLine } from '@/lib/domain/price-label';
import { isWeighed } from '@/lib/domain/pricing';
import { COLORWAYS, serviceLook, type ServiceLook } from '@/lib/domain/service-look';
import { shelfPill } from '@/lib/domain/service-shelf';
import {
  boardTitle,
  showcasePrice,
  showcaseTitle,
  showcaseTone,
  type ShowcaseService,
} from '@/lib/domain/service-showcase';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { ServiceScene } from './service-scene';
import { CROWN, RADII, colors, elevation, fontFor, space, type } from './ui-kit';

export interface ShowcaseCardService extends ShowcaseService {
  name: string;
  /**
   * A photograph of this service, when the shop has one. A picture of the
   * shop's own work beats any drawing, so it takes the object's place.
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
  /** The category, read out with the card's name. */
  categoryLabel?: string;
  /**
   * The drawing's dyes and care tag, decided across the whole list by
   * `serviceLooks` so two services on the same drawing never look alike.
   * Absent, the card reads its look from its own name.
   */
  look?: ServiceLook;
  /** Basket mode: the card carries − and + and shows what is on the ticket. */
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
}

/** How much of the card's width the object takes, and how far it runs off the corner. */
const ART_SHARE = '80%';
const ART_BLEED = '-10%';
/** Tall enough that a two-line name and the object never meet. */
const CARD_HEIGHT = 176;

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

/**
 * A sewn-in care label: the words that tell this service from its sibling,
 * with a strip of the dyes its drawing is made in, so the tag and the pile
 * visibly belong together.
 */
function CareTag({ look }: { look: ServiceLook }) {
  const wear = COLORWAYS[look.colorway];
  return (
    <View style={[styles.tag, { borderColor: wear.accent }]}>
      <View style={styles.tagDyes}>
        {wear.dyes.slice(0, 3).map((dye, i) => (
          <View key={i} style={[styles.tagDye, { backgroundColor: dye }]} />
        ))}
      </View>
      <Text style={styles.tagText} numberOfLines={1}>
        {look.tag}
      </Text>
    </View>
  );
}

/** The object in the corner: the shop's photograph if it has one, else the drawing. */
function CornerArt({
  service,
  look,
  lift,
}: {
  service: ShowcaseCardService;
  look: ServiceLook;
  lift: Animated.Value;
}) {
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const photo = (service.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;
  const tone = showcaseTone(service.category);

  // Under a finger the object leans in toward the name, a little larger.
  const artStyle = {
    transform: [
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
      { rotate: lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) },
    ],
  };

  return (
    <Animated.View style={[styles.art, hasPhoto && styles.photoFrame, artStyle]} pointerEvents="none">
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
        <ServiceScene scene={look.scene} colorway={look.colorway} brand={tone.bg} surface="white" />
      )}
    </Animated.View>
  );
}

export function ServiceTileCard({
  service,
  bookTone,
  onBook,
  categoryLabel,
  look: givenLook,
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
  const look = givenLook ?? serviceLook(service.name, service.category);

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
      damping: 12,
      stiffness: 170,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isEngaged, isReduced, lift]);

  /**
   * The card is the button — a single tap area and, on the web, a single
   * <button> rather than one nested in another.
   */
  const cardPress = isBasket ? (held === 0 ? onAdd : undefined) : onBook;
  const Wrapper = cardPress ? Pressable : View;
  const pressProps = cardPress
    ? {
        accessibilityRole: 'button' as const,
        // `formatPriceLine` already carries the unit and the minimum.
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

  // "×2", "6 kg" or "3 loads": the same words the counter below uses.
  const readout = tileBadge(service, held);
  const isScaled = isWeighed(service);

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
      <CornerArt service={service} look={look} lift={lift} />

      <View style={styles.head}>
        {/* Set as a price board does — "Wash &" over "Fold" — while a screen
            reader hears the plain name through the card's label. */}
        <Text style={styles.name} numberOfLines={3}>
          {boardTitle(service.name)}
        </Text>
        {readout ? (
          <View style={[styles.readout, { backgroundColor: bookTone.bg }]}>
            <Text style={[styles.readoutText, { color: bookTone.ink }]} numberOfLines={1}>
              {readout}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Under the name it qualifies, where it has the card's width; in the
          foot it fought the rate and the pile for the same corner. */}
      {look.tag ? (
        <View style={styles.tagRow}>
          <CareTag look={look} />
        </View>
      ) : null}

      <View style={styles.foot}>
        {isBasket && held > 0 ? (
          <View style={[styles.stepper, { borderColor: bookTone.bg }]}>
            <Step label="−" hint={`Remove ${title}`} onPress={() => onRemove?.()} ink={bookTone.bg} />
            {isScaled ? (
              // Weighed: the amount changes on the scale, so the chip reopens it.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Weigh ${title} again, now ${readout}`}
                onPress={() => onAdd?.()}
                hitSlop={6}
                style={({ pressed }) => [styles.scaleChip, { backgroundColor: bookTone.bg }, pressed && styles.pressed]}
              >
                <Ionicons name="scale-outline" size={14} color={colors.onAccent} />
                <Text style={styles.scaleText}>{readout}</Text>
              </Pressable>
            ) : (
              <>
                <Text style={[styles.stepCount, { color: bookTone.bg }]} accessibilityLiveRegion="polite">
                  {held}
                </Text>
                <Step label="+" hint={`Add one more ${title}`} onPress={() => onAdd?.()} ink={bookTone.bg} />
              </>
            )}
          </View>
        ) : (
          <>
            <View style={[styles.ratePill, { backgroundColor: tone.field }]}>
              <Text style={[styles.rate, { color: tone.ink }]} numberOfLines={1}>
                <Text style={styles.peso}>{price.symbol}</Text>
                {price.amount}
                {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
              </Text>
            </View>
            {/* The shop's minimum rides with the rate it modifies. */}
            {pill.kind === 'rule' ? (
              <Text style={styles.rule} numberOfLines={1}>
                {pill.text}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    // Grow, never `flex: 1`: its zero basis would override the height, and the
    // art is absolute, so nothing inside holds the card open.
    flexGrow: 1,
    minWidth: 0,
    minHeight: CARD_HEIGHT,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'space-between',
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

  /** The object, big and running off the lower right corner. */
  art: {
    position: 'absolute',
    right: ART_BLEED,
    bottom: ART_BLEED,
    width: ART_SHARE,
    aspectRatio: 1,
  },
  /** A photograph has edges a drawing does not: round the one corner that shows. */
  photoFrame: { borderTopLeftRadius: RADII.card, overflow: 'hidden' },

  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.tight,
    paddingHorizontal: space.cosy,
    paddingTop: space.cosy,
  },
  /** The name is the headline: it answers the first question. */
  name: {
    flex: 1,
    maxWidth: '72%',
    ...type.label,
    fontFamily: fontFor(800),
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: colors.text,
  },
  readout: {
    marginLeft: 'auto',
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  readoutText: { ...type.caption, fontSize: 12, lineHeight: 15, fontFamily: fontFor(800), fontVariant: ['tabular-nums'] },

  /** The foot sits over the art's left edge, so it keeps to the left half. */
  foot: {
    alignItems: 'flex-start',
    gap: 3,
    maxWidth: '58%',
    paddingHorizontal: space.cosy,
    paddingBottom: space.cosy,
  },
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

  tagRow: { flexDirection: 'row', maxWidth: '92%', paddingHorizontal: space.cosy, marginTop: space.tight, marginBottom: 'auto' },
  /** Cream label, stitched edge: reads as sewn into the garment, not as a button. */
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: '#FFFDF7',
  },
  tagDyes: { flexDirection: 'row', gap: 1.5 },
  tagDye: {
    width: 5,
    height: 9,
    borderRadius: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(11, 20, 34, 0.18)',
  },
  tagText: {
    ...type.caption,
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: fontFor(800),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.text,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepCount: { ...type.label, fontFamily: fontFor(700), minWidth: 18, textAlign: 'center' },
  scaleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    marginLeft: -1,
  },
  scaleText: { ...type.label, fontFamily: fontFor(700), color: colors.onAccent },
  stepText: { ...type.section, fontSize: 18 },
  pressed: { opacity: 0.6 },
});
