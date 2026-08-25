import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  colors,
} from '@/components/ui-kit';
import { getRegisteredShops, getVisibleShops, joinShop } from '@/lib/api';
import { splitShopsByRegistration } from '@/lib/domain/shop-directory';
import type { Shop } from '@/lib/types';

export default function CustomerShops() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: registered, isLoading: isRegisteredLoading } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  const { data: allShops, isLoading: isDirectoryLoading, error: directoryError } =
    useQuery({
      queryKey: ['visible-shops'],
      queryFn: getVisibleShops,
    });

  const { mine, discoverable } = useMemo(
    () =>
      splitShopsByRegistration(
        allShops ?? [],
        (registered ?? []).map((shop) => shop.id)
      ),
    [allShops, registered]
  );

  const joinMutation = useMutation({
    mutationFn: joinShop,
    onSuccess: async (_result, shopId) => {
      await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
      router.push(`/(customer)/shop/${shopId}` as never);
    },
    onError: (err: Error) => setError(err.message),
  });

  const openShop = (shopId: string) =>
    router.push(`/(customer)/shop/${shopId}` as never);

  if (isRegisteredLoading || isDirectoryLoading) return <Loading />;

  return (
    <Screen>
      {directoryError ? <ErrorText>{(directoryError as Error).message}</ErrorText> : null}
      <ErrorText>{error}</ErrorText>

      <Text style={styles.sectionTitle}>My laundry shops</Text>
      {mine.length === 0 && (
        <EmptyState message="You haven't connected to a laundry shop yet. Pick one below or scan its QR code." />
      )}
      {mine.map((shop) => (
        <ShopCard key={shop.id} shop={shop} onPress={() => openShop(shop.id)}>
          <Button title="View shop" onPress={() => openShop(shop.id)} />
        </ShopCard>
      ))}

      {discoverable.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Laundry shops near you</Text>
          {discoverable.map((shop) => (
            <ShopCard key={shop.id} shop={shop} onPress={() => openShop(shop.id)}>
              <Button
                title={
                  joinMutation.isPending && joinMutation.variables === shop.id
                    ? 'Connecting…'
                    : 'Connect to this shop'
                }
                variant="outline"
                disabled={joinMutation.isPending}
                onPress={() => {
                  setError('');
                  joinMutation.mutate(shop.id);
                }}
              />
            </ShopCard>
          ))}
        </>
      )}
    </Screen>
  );
}

function ShopCard({
  shop,
  onPress,
  children,
}: {
  shop: Shop;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.shopRow}>
        <View style={styles.shopIcon}>
          <Ionicons name="storefront" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} onPress={onPress}>
            {shop.name}
          </Text>
          {shop.address ? <Subtle>{shop.address}</Subtle> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { fontWeight: '600', fontSize: 16, color: colors.text },
});
