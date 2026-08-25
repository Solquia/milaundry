import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import {
  getRegisteredShops,
  getServices,
  getShop,
  getShopReviews,
  joinShop,
} from '@/lib/api';
import { categoryIcon } from '@/lib/domain/shop-home';

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={14}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

/** Tint pairs cycled across grid tiles so the grid feels lively, not flat. */
const TILE_TINTS = [
  { bg: '#E0F2FE', fg: '#0284C7' },
  { bg: '#E0E7FF', fg: '#4F46E5' },
  { bg: '#CCFBF1', fg: '#0D9488' },
  { bg: '#FEF3C7', fg: '#D97706' },
];

export default function CustomerShopHome() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [joinError, setJoinError] = useState('');

  const { data: shop, isLoading: isShopLoading, error: shopError } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => getShop(id!),
    enabled: Boolean(id),
  });

  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['services', id],
    queryFn: () => getServices(id!),
    enabled: Boolean(id),
  });

  const { data: reviews } = useQuery({
    queryKey: ['shop-reviews', id],
    queryFn: () => getShopReviews(id!),
    enabled: Boolean(id),
  });

  const { data: registered } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  // Orders are only accepted from customers registered with the shop, so the
  // services grid stays locked behind a one-tap connect until then.
  const isRegistered = (registered ?? []).some((row) => row.id === id);

  const joinMutation = useMutation({
    mutationFn: () => joinShop(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registered-shops'] }),
    onError: (err: Error) => setJoinError(err.message),
  });

  if (isShopLoading || isServicesLoading) return <Loading />;

  return (
    <Screen>
      {shopError ? <ErrorText>{(shopError as Error).message}</ErrorText> : null}

      {/* Branded header: just the laundry's name, front and center. */}
      <View style={styles.hero}>
        <Ionicons name="water" size={28} color="#BFE7FF" />
        <Text style={styles.heroName}>{shop?.name ?? 'Laundry shop'}</Text>
        {shop?.address ? <Text style={styles.heroAddress}>{shop.address}</Text> : null}
      </View>

      {!isRegistered && (
        <Card>
          <Text style={styles.sectionTitle}>Connect to book</Text>
          <Subtle>
            Connect to {shop?.name ?? 'this shop'} to place orders and track your
            laundry.
          </Subtle>
          <ErrorText>{joinError}</ErrorText>
          <Button
            title={joinMutation.isPending ? 'Connecting…' : 'Connect to this shop'}
            disabled={joinMutation.isPending}
            onPress={() => {
              setJoinError('');
              joinMutation.mutate();
            }}
          />
        </Card>
      )}

      {/* Services grid straight from the owner's dashboard price list. */}
      <Card>
        <Text style={styles.sectionTitle}>Services</Text>
        {services?.length === 0 && (
          <EmptyState message="This shop hasn't listed services yet." />
        )}
        <View style={styles.grid}>
          {services?.map((service, index) => {
            const tint = TILE_TINTS[index % TILE_TINTS.length];
            return (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                accessibilityLabel={`Book ${service.name}`}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  if (!isRegistered) {
                    setJoinError('Connect to this shop first to book a service.');
                    return;
                  }
                  router.push(`/(customer)/book/${service.id}?shopId=${id}` as never);
                }}
              >
                <View style={[styles.tileIcon, { backgroundColor: tint.bg }]}>
                  <Ionicons
                    name={categoryIcon(service.category) as never}
                    size={24}
                    color={tint.fg}
                  />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {service.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Live reviews feed — rendered inline, not hidden behind a button. */}
      <Text style={styles.sectionTitle}>What customers say</Text>
      {!reviews?.length && (
        <Card>
          <Subtle>
            No reviews yet. Reviews from customers will show up here after their
            orders are completed.
          </Subtle>
        </Card>
      )}
      {reviews?.map((review) => (
        <Card key={review.id} compact>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={styles.reviewerName}>
              {review.reviewer?.full_name ?? 'Customer'}
            </Text>
            <Stars rating={review.rating} />
          </View>
          {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroAddress: {
    color: '#D6ECFF',
    fontSize: 13,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  tile: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  reviewerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  reviewComment: { fontSize: 14, color: colors.text },
});
