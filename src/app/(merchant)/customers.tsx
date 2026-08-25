import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  Title,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getShopCustomers } from '@/lib/api';
import { buildShopQr } from '@/lib/domain/qr';
import { useActiveShop } from '@/lib/use-active-shop';

export default function MerchantCustomers() {
  const { shop, isLoading: isShopLoading } = useActiveShop();

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['shop-customers', shop?.id],
    queryFn: () => getShopCustomers(shop!.id),
    enabled: Boolean(shop),
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  const shopQr = buildShopQr(shop.id, shop.qr_token);

  return (
    <Screen>
      <Card>
        <Title>Your shop QR</Title>
        <Subtle>
          Customers scan this with the MiLaundry app to connect to {shop.name} — then they can
          book online and track their laundry.
        </Subtle>
        <View style={{ alignItems: 'center', padding: 12 }}>
          <QRCode value={shopQr} size={220} />
        </View>
        <Button
          title="Share shop link"
          variant="outline"
          onPress={() =>
            Share.share({ message: `Connect to ${shop.name} on MiLaundry: ${shopQr}` })
          }
        />
      </Card>

      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {customers?.length === 0 && (
        <EmptyState message="No registered customers yet. Show this QR at the counter to register them." />
      )}
      {customers && customers.length > 0 && (
        <Text style={{ fontWeight: '700', fontSize: 18 }}>
          Registered customers ({customers.length})
        </Text>
      )}
      {customers?.map((customer) => (
        <Card key={customer.customer_id}>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>
            {customer.full_name || 'Unnamed customer'}
          </Text>
          <Subtle>{customer.phone}</Subtle>
          <Subtle>
            {customer.order_count} orders · {formatMoney(Number(customer.total_spend))} spent
          </Subtle>
          <Subtle>
            {customer.last_order_at
              ? `Last order ${formatDate(customer.last_order_at)}`
              : 'No orders yet'}
          </Subtle>
        </Card>
      ))}
    </Screen>
  );
}
