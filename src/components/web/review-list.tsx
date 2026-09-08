/**
 * What customers said, without who said it.
 *
 * The app shows the reviewer's name because the reader is a signed-in
 * customer of the same shop. A public page is read by anyone, so the name
 * stays off it; the stars and the words are what a stranger needs.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import type { Reputation } from '@/lib/domain/storefront';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontReview } from '@/lib/types';

const MAX_STARS = 5;

interface ReviewListProps {
  reviews: readonly StorefrontReview[];
  reputation: Reputation | null;
  theme: StorefrontTheme;
}

export function ReviewList({ reviews, reputation, theme }: ReviewListProps) {
  if (!reputation || reviews.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.verdict}>
        <Text style={styles.score}>{reputation.average.toFixed(1)}</Text>
        <View style={styles.verdictWords}>
          <Stars rating={Math.round(reputation.average)} color={theme.brand} />
          <Text style={styles.count}>
            {reputation.count === 1
              ? 'from 1 completed order'
              : `from ${reputation.count} completed orders`}
          </Text>
        </View>
      </View>
      {reviews
        .filter((review) => review.comment.trim().length > 0)
        .map((review) => (
          <View key={review.id} style={styles.review}>
            <Stars rating={review.rating} color={theme.brand} />
            <Text style={styles.comment}>{review.comment}</Text>
          </View>
        ))}
    </View>
  );
}

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} out of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Ionicons
          key={index}
          name={index < rating ? 'star' : 'star-outline'}
          size={14}
          color={index < rating ? color : colors.border}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, padding: space.room },
  score: { ...type.hero, color: colors.text, fontVariant: ['tabular-nums'] },
  verdictWords: { gap: 2 },
  count: { ...type.caption, color: colors.subtle },
  stars: { flexDirection: 'row', gap: 2 },
  review: {
    gap: space.tight,
    padding: space.room,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  comment: { ...type.body, color: colors.text },
});
