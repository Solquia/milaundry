import React from 'react';
import { Alert, Text, View } from 'react-native';

import { BrandingCard } from '@/components/branding-card';
import { DoorbellCard } from '@/components/doorbell-card';
import { PaymentRailsCard } from '@/components/payment-rails-card';
import { PrinterCard } from '@/components/printer-card';
import { ShopLocationCard } from '@/components/shop-location-card';
import { StaffCard } from '@/components/staff-card';
import { WebPageCard } from '@/components/web-page-card';
import { ACCENTS, Button, Card, Loading, Screen, Subtle, colors, space, type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { signOutPrompt } from '@/lib/domain/confirm-prompts';
import { canManageShop, describeShopAccess, shopRoleBadge } from '@/lib/domain/merchant-access';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { canAddStaff } from '@/lib/domain/staff-invite';
import { useActiveShop } from '@/lib/use-active-shop';

/**
 * The account screen the app never had. Sign-out used to be a bare text link
 * at the end of the scrolling order list, so where it landed on screen
 * depended on how many orders the shop had that day — on a quiet morning it
 * sat squarely in the thumb arc above the tab bar.
 *
 * This is also the only place the merchant UI says whose shop this is.
 */
export default function MerchantSettings() {
  const { profile, signOut } = useAuth();
  const { shop, shopRole, isLoading } = useActiveShop();
  // Staff run the counter, not the shop: they get the printer and sign-out,
  // and none of the cards that change what customers see or how they pay.
  const isOwner = canManageShop(shopRole);

  const confirmSignOut = () => {
    const prompt = signOutPrompt();
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.dismissLabel, style: 'cancel' },
      { text: prompt.confirmLabel, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (isLoading) return <Loading />;

  // A shop that has not loaded still needs a tone for the chip; the first
  // accent is the app's own blue, which is what "no shop assigned" should wear.
  const accent = shop ? ACCENTS[resolveAccent(shop, ACCENTS.length)] : ACCENTS[0];

  return (
    <Screen>
      <Card>
        <Subtle>Signed in to</Subtle>
        {/* The role rides beside the shop's name in the shop's own colour —
            the same chip, the same word, as the band on the till. Four grey
            lines in a column made the one fact that decides what this person
            can open the least visible thing on the card. */}
        <View style={styles.shopRow}>
          <Text style={styles.shopName}>{shop?.name ?? 'No shop assigned'}</Text>
          <View style={[styles.roleChip, { backgroundColor: accent.surface }]}>
            <Text style={[styles.roleText, { color: accent.ink }]}>
              {shopRoleBadge(shopRole)}
            </Text>
          </View>
        </View>
        {profile?.full_name ? <Subtle>{profile.full_name}</Subtle> : null}
        {profile?.username ? <Subtle>Login: {profile.username}</Subtle> : null}
        <Subtle>{describeShopAccess(shopRole)}</Subtle>
      </Card>

      {/* Branding before payment: this is the card an owner comes looking for,
          and the one they will change more than once. */}
      {shop && isOwner ? <BrandingCard shop={shop} /> : null}
      {shop && isOwner ? <WebPageCard shop={shop} /> : null}
      {shop && isOwner ? <ShopLocationCard shop={shop} /> : null}
      {shop && isOwner ? <PaymentRailsCard shop={shop} /> : null}
      {shop ? <DoorbellCard /> : null}
      {shop ? <PrinterCard shop={shop} /> : null}

      {/* Last of the owner cards: adding a person is rarer than changing a
          price or a payment rail, and it is the one that hands out a key. */}
      {shop && canAddStaff(shopRole) ? <StaffCard shop={shop} /> : null}

      <View style={styles.signOut}>
        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

const styles = {
  shopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.snug },
  shopName: { fontSize: 22, fontWeight: '700' as const, color: colors.text, flexShrink: 1 },
  roleChip: { paddingHorizontal: space.snug, paddingVertical: 2, borderRadius: 999 },
  roleText: { ...type.caption, fontSize: 12 },
  // Kept away from the account card so the destructive action is never what a
  // thumb lands on while reading who is signed in.
  signOut: { marginTop: space.gulf },
};
