/**
 * What this shop's customers actually said.
 *
 * The average alone is the least interesting true thing about a shop: 4.0 from
 * forty fives and ten ones is a different place from 4.0 where everyone said
 * four, and a stranger deciding where to take their washing is weighing exactly
 * that difference. So the score arrives with the shape behind it — the ladder
 * of bands, longest bar first — and then the words, because the words are what
 * anybody actually reads.
 *
 * One component for both surfaces. The app shows the reviewer's name because
 * the reader is a signed-in customer of the same shop; a public web page is
 * read by anyone, so `showNames` turns that off and the stars and the words are
 * what a stranger gets.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Reveal, REVEAL_STAGGER_MS } from '@/components/reveal';
import { ServiceScene } from '@/components/service-scene';
import { LIFT_MARK, LightSweep } from '@/components/storefront-flourishes';
import { colors, elevation, space, type } from '@/components/ui-kit';
import { ratingBreakdown, type Reputation } from '@/lib/domain/storefront';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const MAX_STARS = 5;
/** Long enough to read as counting, short enough that nobody waits for it. */
const COUNT_MS = 900;
const BAR_MS = 720;

export interface ShownReview {
  id: string;
  rating: number;
  comment: string | null;
  reviewerName?: string | null;
}

interface ReviewShowcaseProps {
  reviews: readonly ShownReview[];
  reputation: Reputation | null;
  theme: StorefrontTheme;
  /** The app names its reviewers; a public page does not. */
  showNames?: boolean;
}

export function ReviewShowcase({
  reviews,
  reputation,
  theme,
  showNames = false,
}: ReviewShowcaseProps) {
  if (!reputation) return null;
  const bands = ratingBreakdown(reviews);
  const spoken = reviews.filter((review) => (review.comment ?? '').trim().length > 0);

  return (
    <View style={styles.stack}>
      <View style={[styles.verdictCard, { backgroundColor: theme.brandSoft }]} {...LIFT_MARK}>
        <View style={styles.verdict}>
          <View style={styles.verdictWords}>
            <View style={styles.scoreLine}>
              <CountUp to={reputation.average} style={styles.score} />
              <ArrivingStars rating={Math.round(reputation.average)} colour={theme.brand} />
            </View>
            <Text style={styles.verdictTitle}>{verdictFor(reputation.average)}</Text>
            <Text style={styles.count}>
              {reputation.count === 1
                ? 'from 1 completed order'
                : `from ${reputation.count} completed orders`}
            </Text>
          </View>
          {/* The thing the reviews are about: a stack of somebody's washing,
              done. Drawn by the same engine as the price grid's tiles, so the
              page keeps one hand from top to bottom. */}
          <View style={styles.scene} accessibilityElementsHidden>
            <ServiceScene scene="stack" brand={theme.brand} surface="white" />
          </View>
        </View>

        <View style={styles.ladder}>
          {bands.map((band, index) => (
            <View key={band.stars} style={styles.rung}>
              <Text style={styles.rungLabel}>{band.stars}</Text>
              <Ionicons name="star" size={11} color={theme.brand} />
              <View style={[styles.track, { backgroundColor: colors.card }]}>
                <GrowingBar share={band.share} colour={theme.brand} delay={index * 70} />
              </View>
              <Text style={styles.rungCount}>{band.count}</Text>
            </View>
          ))}
        </View>
      </View>

      {spoken.map((review, index) => (
        <Reveal key={review.id} delay={index * REVEAL_STAGGER_MS}>
          <QuoteCard
            review={review}
            theme={theme}
            showName={showNames}
            /** Every other card takes the shop's colour, so a run of them has
                a beat instead of reading as one long wall of white. */
            tinted={index % 2 === 1}
          />
        </Reveal>
      ))}
    </View>
  );
}

/** The score, said in words. A number needs a sentence to mean anything. */
function verdictFor(average: number): string {
  if (average >= 4.8) return 'Customers love this shop';
  if (average >= 4.3) return 'Customers rate it highly';
  if (average >= 3.5) return 'Customers are happy here';
  if (average >= 2.5) return 'Mixed so far';
  return 'Room to improve';
}

interface QuoteCardProps {
  review: ShownReview;
  theme: StorefrontTheme;
  showName: boolean;
  tinted: boolean;
}

function QuoteCard({ review, theme, showName, tinted }: QuoteCardProps) {
  const name = review.reviewerName?.trim();
  return (
    <View
      style={[
        styles.quoteCard,
        tinted ? { backgroundColor: theme.brandSoft, borderColor: theme.brandSoft } : null,
      ]}
      {...LIFT_MARK}
    >
      <View style={styles.attribution}>
        <Stars rating={review.rating} colour={theme.brand} size={14} />
        {/* Not a decoration: every review on this page came out of a finished
            order, and saying so is what separates it from an internet rating. */}
        <View style={[styles.badge, { backgroundColor: tinted ? colors.card : theme.brandSoft }]}>
          <Ionicons name="checkmark-circle" size={13} color={theme.brandInk} />
          <Text style={[styles.badgeText, { color: theme.brandInk }]}>Verified order</Text>
        </View>
      </View>
      <Text style={styles.comment}>{review.comment}</Text>
      {showName && name ? <Text style={styles.byline}>{name}</Text> : null}
    </View>
  );
}

const STAR_STEP_MS = 90;

/**
 * The stars, struck one after the other.
 *
 * Five stars appearing together is a value being printed. Five landing in
 * sequence is a verdict being counted out, which is the thing the number beside
 * them is trying to say. Only the masthead does this — a star row inside a
 * review card is a fact about that review, not an announcement.
 */
function ArrivingStars({ rating, colour }: { rating: number; colour: string }) {
  const isReduced = useReducedMotion();

  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Star
          key={index}
          filled={index < rating}
          colour={colour}
          size={17}
          delay={isReduced ? 0 : index * STAR_STEP_MS}
          isReduced={isReduced}
        />
      ))}
    </View>
  );
}

function Star({
  filled,
  colour,
  size,
  delay,
  isReduced,
}: {
  filled: boolean;
  colour: string;
  size: number;
  delay: number;
  isReduced: boolean;
}) {
  const [strike] = useState(() => new Animated.Value(isReduced ? 1 : 0));

  useEffect(() => {
    if (isReduced) {
      strike.setValue(1);
      return;
    }
    const animation = Animated.spring(strike, {
      toValue: 1,
      delay,
      damping: 9,
      stiffness: 190,
      mass: 0.7,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, isReduced, strike]);

  return (
    <Animated.View
      style={
        isReduced
          ? null
          : {
              opacity: strike.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [
                { scale: strike.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              ],
            }
      }
    >
      <Ionicons
        name={filled ? 'star' : 'star-outline'}
        size={size}
        color={filled ? colour : colors.borderStrong}
      />
    </Animated.View>
  );
}

function Stars({ rating, colour, size }: { rating: number; colour: string; size: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Ionicons
          key={index}
          name={index < rating ? 'star' : 'star-outline'}
          size={size}
          color={index < rating ? colour : colors.borderStrong}
        />
      ))}
    </View>
  );
}

/**
 * The score, counted up to.
 *
 * The one number on the page a customer came for, so it is the one thing that
 * announces itself. It settles on the real figure and stays there; a device
 * asking for less motion is simply handed the figure.
 */
function CountUp({ to, style }: { to: number; style: object }) {
  const isReduced = useReducedMotion();
  const [counted, setCounted] = useState(0);
  // Derived, not written from the effect: a device asking for less motion is
  // handed the figure rather than animated to it.
  const shown = isReduced ? to : counted;
  // Lazy state, not a ref: the driver is read during render to build the
  // interpolation, and reading a ref there is a hook-rules violation.
  const [driver] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) return;
    const id = driver.addListener(({ value }) => setCounted(value * to));
    const animation = Animated.timing(driver, {
      toValue: 1,
      duration: COUNT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(() => setCounted(to));
    return () => {
      animation.stop();
      driver.removeListener(id);
    };
  }, [driver, isReduced, to]);

  return (
    <Text style={style} accessibilityLabel={to.toFixed(1)}>
      {shown.toFixed(1)}
    </Text>
  );
}

/**
 * One rung of the ladder, growing to its share of the busiest band, with a
 * pass of light chasing the fill along it.
 *
 * The bar measures itself so the light knows where to stop: a sweep that ran
 * the width of the track would cross empty ground and read as a skeleton
 * loading rather than as a figure landing.
 */
function GrowingBar({ share, colour, delay }: { share: number; colour: string; delay: number }) {
  const isReduced = useReducedMotion();
  const [grow] = useState(() => new Animated.Value(isReduced ? 1 : 0));
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (isReduced) {
      grow.setValue(1);
      return;
    }
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration: BAR_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      // A width cannot be driven off the UI thread, and five short bars are
      // well inside what the JS driver handles without dropping a frame.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, grow, isReduced]);

  const width = grow.interpolate({
    inputRange: [0, 1],
    // Never fully empty: a hairline says "nobody said this", an absent bar
    // says the row failed to draw.
    outputRange: ['0%', `${Math.max(share * 100, share > 0 ? 6 : 0)}%`],
  });

  return (
    <Animated.View
      style={[styles.bar, { width, backgroundColor: colour }]}
      onLayout={(event) => setFilled(Math.round(event.nativeEvent.layout.width))}
    >
      {share > 0 ? <LightSweep delay={delay} width={filled} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.cosy },
  verdictCard: {
    borderRadius: 22,
    padding: space.room,
    gap: space.room,
    overflow: 'hidden',
    ...elevation.rest,
  },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  /** The figure and the stars on one line, the way a verdict is read aloud. */
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  /**
   * The drawn object, sized to the block of words beside it rather than to the
   * card, so a long verdict line never squeezes it into a smudge.
   */
  scene: { width: 96, height: 96, marginVertical: -space.snug },
  score: { ...type.hero, fontSize: 46, lineHeight: 50, color: colors.text, fontVariant: ['tabular-nums'] },
  verdictWords: { flex: 1, gap: space.tight },
  verdictTitle: { ...type.section, fontSize: 17, color: colors.text },
  count: { ...type.caption, color: colors.subtle },
  ladder: { gap: space.snug },
  rung: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  rungLabel: { ...type.caption, color: colors.subtle, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 9, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 9, borderRadius: 5, overflow: 'hidden' },
  rungCount: {
    ...type.caption,
    color: colors.subtle,
    minWidth: 24,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  quoteCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
  },
  /** The words are the point of the card, so they are set above body size. */
  comment: { ...type.body, fontSize: 16, lineHeight: 24, color: colors.text },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { ...type.caption, fontSize: 11, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 2 },
  byline: { ...type.caption, color: colors.subtle, marginTop: space.tight },
});
