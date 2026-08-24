import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
} from '@/components/ui-kit';
import { adminCreateShop, getAllShops } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminShops() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });

  const mutation = useMutation({
    mutationFn: () => adminCreateShop(name.trim(), address.trim(), phone.trim()),
    onSuccess: () => {
      setName('');
      setAddress('');
      setPhone('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isLoading) return <Loading />;

  return (
    <Screen>
      {shops?.length === 0 && <EmptyState message="No shops yet. Create the first one below." />}
      {shops?.map((shop) => (
        <Link key={shop.id} href={`/(admin)/shop/${shop.id}`} asChild>
          <View>
            <Card>
              <Text style={{ fontWeight: '600', fontSize: 16 }}>{shop.name}</Text>
              <Subtle>{shop.address}</Subtle>
            </Card>
          </View>
        </Link>
      ))}
      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Add laundry shop</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Sparkle Wash" />
        <Field label="Address" value={address} onChangeText={setAddress} placeholder="123 Rizal Ave" />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0917 123 4567"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title={mutation.isPending ? 'Creating…' : 'Create shop'}
          onPress={() => {
            if (!name.trim()) {
              setError('Enter a shop name.');
              return;
            }
            mutation.mutate();
          }}
          disabled={mutation.isPending}
        />
      </Card>
      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
