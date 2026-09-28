import { useRouter } from 'expo-router';
import React from 'react';

import { Button, Screen, Subtle, Title } from '@/components/ui-kit';

/**
 * Where a phone camera lands after scanning a bag tag outside the app.
 *
 * The tag is the shop's, not the customer's: it carries no token and this
 * page shows nothing about the order. The shop opens it from its own scanner,
 * signed in; everyone else is pointed at the receipt, which is theirs.
 */
export default function TagLanding() {
  const router = useRouter();
  return (
    <Screen>
      <Title>This is a laundry shop&apos;s bag tag</Title>
      <Subtle>
        Only the shop can open it, from the scanner in the MiLaundry app. If this is your
        laundry, scan the code on your receipt instead to follow your order.
      </Subtle>
      <Button title="Go to MiLaundry" variant="outline" onPress={() => router.replace('/' as never)} />
    </Screen>
  );
}
