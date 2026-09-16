/**
 * What customers said, without who said it.
 *
 * The presentation is `components/review-showcase`, shared with the app so a
 * shop's reputation reads the same wherever a customer meets it. The one
 * difference is the byline: the app's reader is a signed-in customer of the
 * same shop, a public page is read by anyone, so the names stay off this one.
 */
import React from 'react';

import { ReviewShowcase } from '@/components/review-showcase';
import type { Reputation } from '@/lib/domain/storefront';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontReview } from '@/lib/types';

interface ReviewListProps {
  reviews: readonly StorefrontReview[];
  reputation: Reputation | null;
  theme: StorefrontTheme;
}

export function ReviewList({ reviews, reputation, theme }: ReviewListProps) {
  if (!reputation || reviews.length === 0) return null;
  return <ReviewShowcase reviews={reviews} reputation={reputation} theme={theme} />;
}
