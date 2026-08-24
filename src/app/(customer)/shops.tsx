import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
} from '@/components/ui-kit';
import { getRegisteredShops } from '@/lib/api';

export default function CustomerShops() {
  const router = useRouter();
  const { data: shops, isLoading, error } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  if (isLoading) return <Loading />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {shops?.length === 0 && (
        <EmptyState message="No registered shops yet. Scan your laundry shop's QR code to register." />
      )}
      {shops?.map((shop) => (
        <Card key={shop.id}>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>{shop.name}</Text>
          <Subtle>{shop.address}</Subtle>
          <Button
            title="New order"
            onPress={() => router.push(`/(customer)/new-order?shopId=${shop.id}`)}
          />
        </Card>
      ))}
    </Screen>
  );
}
