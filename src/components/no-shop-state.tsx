import React from 'react';

import { useAuth } from '@/lib/auth';
import { useActiveShop } from '@/lib/use-active-shop';

import { EmptyState, ErrorState } from './ui-kit';

/**
 * What a merchant screen shows when it has no shop to draw. Two very different
 * causes land here: the shop could not be reached (no signal, a server hiccup)
 * or the account truly belongs to no shop. Telling a working merchant at the
 * counter to "ask your administrator" over a dropped connection is the wrong
 * answer, so a failure says so and offers another try — and even the genuine
 * "no shop" answer can be asked again in place.
 */
export function NoShopState() {
  const { error, refetch } = useActiveShop();
  const { refreshProfile } = useAuth();

  const tryAgain = () => {
    void refreshProfile();
    refetch();
  };

  if (error) {
    return (
      <ErrorState
        message="Couldn't reach your shop. Check the internet connection and try again."
        onRetry={tryAgain}
      />
    );
  }

  return (
    <EmptyState
      message="Your account is not connected to a shop yet. Ask your administrator to add you."
      actionLabel="Check again"
      onAction={tryAgain}
    />
  );
}
