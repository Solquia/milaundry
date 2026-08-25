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
  PhoneField,
  Screen,
  Subtle,
  colors,
} from '@/components/ui-kit';
import { adminCreateShop, getAllShops } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyAdminError } from '@/lib/domain/admin-error';
import { validateShopForm } from '@/lib/domain/shop-form';

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
    mutationFn: adminCreateShop,
    onSuccess: () => {
      setName('');
      setAddress('');
      setPhone('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
    },
    onError: (err: Error) => setError(friendlyAdminError(err.message, phone)),
  });

  const handleCreate = () => {
    const result = validateShopForm({ name, address, phoneInput: phone });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    mutation.mutate(result.values);
  };

  if (isLoading) return <Loading />;

  return (
    <Screen>
      {shops?.length === 0 && (
        <EmptyState message="No shops yet. Create the first one below." />
      )}
      {shops?.map((shop) => (
        <Link key={shop.id} href={`/(admin)/shop/${shop.id}`} asChild>
          <View>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '600', fontSize: 16, flex: 1 }}>
                  {shop.name}
                </Text>
                {!shop.is_active && (
                  <View
                    style={{
                      backgroundColor: colors.subtle,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                      Inactive
                    </Text>
                  </View>
                )}
              </View>
              <Subtle>{shop.address || 'No address on file'}</Subtle>
            </Card>
          </View>
        </Link>
      ))}

      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Add laundry shop</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Sparkle Wash" />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="123 Rizal Ave"
        />
        <PhoneField label="Contact number (optional)" value={phone} onChangeText={setPhone} />
        <ErrorText>{error}</ErrorText>
        <Button
          title={mutation.isPending ? 'Creating…' : 'Create shop'}
          onPress={handleCreate}
          disabled={mutation.isPending}
        />
      </Card>

      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
