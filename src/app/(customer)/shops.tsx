import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ACCENTS,
  EmptyState,
  Loading,
  Screen,
  Subtle,
  colors,
  elevation,
  space,
  type,
} from '@/components/ui-kit';
import { getRegisteredShops } from '@/lib/api';
import { assignBrandAccents } from '@/lib/domain/shop-branding';
import { shopInitials } from '@/lib/domain/connected-shops';
import { emptyDirectoryMessage } from '@/lib/domain/shop-directory';
import type { Shop } from '@/lib/types';

/**
 * The customer's own laundries, and nothing else.
 *
 * This tab used to go on to list every other shop in the system under "More
 * laundry shops", with a connect button on each. A customer meets a laundry by
 * standing in it, not by browsing — so the way to a new shop is the code at
 * its counter, and the list of everyone else's laundries is gone.
 */
export default function CustomerShops() {
  const router = useRouter();

  const { data: registered, isLoading } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  const mine = useMemo(() => registered ?? [], [registered]);

  // Assigned across the list, so two of your shops never share a tone — but a
  // tone a shop chose for itself is held fixed, and only the rest walk.
  const mineAccents = useMemo(
    () =>
      assignBrandAccents(
        mine.map((shop) => ({ id: shop.id, brand_accent: shop.brand_accent })),
        ACCENTS.length
      ),
    [mine]
  );

  const openShop = (shopId: string) =>
    router.push(`/(customer)/shop/${shopId}` as never);

  const emptyMessage = emptyDirectoryMessage(mine.length);

  if (isLoading) return <Loading />;

  return (
    <Screen>
      <Text style={styles.sectionTitle}>Your laundry shops</Text>
      {emptyMessage ? <EmptyState message={emptyMessage} /> : null}
      {mine.map((shop, index) => (
        <ShopCard
          key={shop.id}
          shop={shop}
          accent={ACCENTS[mineAccents[index]]}
          onPress={() => openShop(shop.id)}
        />
      ))}
    </Screen>
  );
}

/**
 * A shop you have connected to wears its initials in its own accent — the same
 * tone it carries on the home screen and across the top of its own page — and
 * the card takes a hairline of that accent, so "mine" reads as a set before a
 * word of it is read. One you have not wears a plain storefront glyph and
 * spends its colour on the one thing you can do about that: connect.
 *
 * Three roles, one each: accent means yours, blue means you can act here, grey
 * means not yet.
 */
function ShopCard({
  shop,
  accent,
  onPress,
  children,
}: {
  shop: Shop;
  accent?: (typeof ACCENTS)[number];
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, accent && { borderColor: accent.ink }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.shopRow, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.shopIcon, accent && { backgroundColor: accent.surface }]}>
          {accent ? (
            <Text style={[styles.shopInitials, { color: accent.ink }]}>
              {shopInitials(shop.name)}
            </Text>
          ) : (
            <Ionicons name="storefront" size={20} color={colors.subtle} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.address ? <Subtle>{shop.address}</Subtle> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...type.section, color: colors.text, marginTop: space.tight },
  // Rebuilt from the same recipe as `ui-kit`'s Card so a connected shop can
  // carry its accent on the border. One hairline, never a slab.
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space.room,
    gap: space.snug,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.rest,
  },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInitials: { ...type.label, fontSize: 15 },
  shopName: { ...type.label, fontSize: 16, color: colors.text },
});
