import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  Title,
} from '@/components/ui-kit';
import { adminAssignMerchant, getAllShops } from '@/lib/api';
import { normalizePhone } from '@/lib/domain/phone';
import { buildShopQr } from '@/lib/domain/qr';

export default function AdminShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [merchantPhone, setMerchantPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const shop = shops?.find((candidate) => candidate.id === id);

  const mutation = useMutation({
    mutationFn: (phone: string) => adminAssignMerchant(id!, phone),
    onSuccess: () => {
      setMessage('Merchant assigned.');
      setMerchantPhone('');
      setError('');
    },
    onError: (err: Error) => {
      setMessage('');
      setError(err.message);
    },
  });

  const handleAssign = () => {
    const normalized = normalizePhone(merchantPhone);
    if (!normalized) {
      setError('Enter a valid mobile number.');
      return;
    }
    mutation.mutate(normalized);
  };

  if (isLoading || !shop) return <Loading />;

  return (
    <Screen>
      <Title>{shop.name}</Title>
      <Subtle>{shop.address}</Subtle>
      <Card>
        <Text style={{ fontWeight: '600' }}>Shop registration QR</Text>
        <Subtle>Print this for the counter — customers scan it to register with the shop.</Subtle>
        <View style={{ alignItems: 'center', padding: 12 }}>
          <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={200} />
        </View>
      </Card>
      <Card>
        <Text style={{ fontWeight: '600' }}>Assign merchant</Text>
        <Subtle>
          The user must already have a MiLaundry account. They will be promoted to merchant and
          attached to this shop.
        </Subtle>
        <Field
          label="Merchant mobile number"
          value={merchantPhone}
          onChangeText={setMerchantPhone}
          keyboardType="phone-pad"
          placeholder="0917 123 4567"
        />
        <ErrorText>{error}</ErrorText>
        {message ? <Subtle>{message}</Subtle> : null}
        <Button
          title={mutation.isPending ? 'Assigning…' : 'Assign merchant'}
          onPress={handleAssign}
          disabled={mutation.isPending}
        />
      </Card>
    </Screen>
  );
}
