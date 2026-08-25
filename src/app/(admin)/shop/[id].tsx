import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

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
  Title,
  colors,
} from '@/components/ui-kit';
import {
  adminAssignMerchant,
  adminCreateShopAccount,
  adminListShopMembers,
  adminRemoveShopMember,
  adminSetShopActive,
  getAllShops,
} from '@/lib/api';
import { friendlyAdminError } from '@/lib/domain/admin-error';
import { buildShopQr } from '@/lib/domain/qr';
import type { ShopAccountRole } from '@/lib/domain/shop-account';
import { SHOP_ACCOUNT_ROLES, validateShopAccountForm } from '@/lib/domain/shop-account';
import { canRemoveMember, describeMemberRole } from '@/lib/domain/shop-member';
import { generateTempPassword } from '@/lib/domain/temp-password';

export default function AdminShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shopId = id!;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generateTempPassword());
  const [role, setRole] = useState<ShopAccountRole>('owner');
  const [existingPhone, setExistingPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const shop = shops?.find((candidate) => candidate.id === shopId);

  const { data: members } = useQuery({
    queryKey: ['admin-shop-members', shopId],
    queryFn: () => adminListShopMembers(shopId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-shop-members', shopId] });
    queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
  };

  const report = (err: Error, contextPhone: string) => {
    setMessage('');
    setError(friendlyAdminError(err.message, contextPhone));
  };

  const createAccount = useMutation({
    mutationFn: () => {
      const result = validateShopAccountForm({ fullName, phoneInput: phone, password, role });
      if (!result.ok) return Promise.reject(new Error(result.message));
      return adminCreateShopAccount(shopId, result.account);
    },
    onSuccess: () => {
      setError('');
      setMessage(
        `Account created for ${fullName.trim()}. Give them the mobile number and temporary password above — they can sign in now.`
      );
      setFullName('');
      setPhone('');
      refresh();
    },
    onError: (err: Error) => report(err, phone),
  });

  const assignExisting = useMutation({
    mutationFn: () => {
      const result = validateShopAccountForm({
        fullName: 'existing account',
        phoneInput: existingPhone,
        password: 'placeholder',
        role,
      });
      if (!result.ok) return Promise.reject(new Error(result.message));
      return adminAssignMerchant(shopId, result.account.phone, result.account.role);
    },
    onSuccess: () => {
      setError('');
      setMessage('Existing account attached to this shop.');
      setExistingPhone('');
      refresh();
    },
    onError: (err: Error) => report(err, existingPhone),
  });

  const removeMember = useMutation({
    mutationFn: (profileId: string) => {
      const check = canRemoveMember(members ?? [], profileId);
      if (!check.ok) return Promise.reject(new Error(check.reason));
      return adminRemoveShopMember(shopId, profileId);
    },
    onSuccess: () => {
      setError('');
      setMessage('Account removed from this shop.');
      refresh();
    },
    onError: (err: Error) => report(err, ''),
  });

  const toggleActive = useMutation({
    mutationFn: () => adminSetShopActive(shopId, !shop!.is_active),
    onSuccess: () => {
      setError('');
      setMessage(shop!.is_active ? 'Shop deactivated.' : 'Shop reactivated.');
      refresh();
    },
    onError: (err: Error) => report(err, ''),
  });

  if (isLoading || !shop) return <Loading />;

  return (
    <Screen>
      <Title>{shop.name}</Title>
      <Subtle>{shop.address || 'No address on file'}</Subtle>

      <ErrorText>{error}</ErrorText>
      {message ? <Subtle>{message}</Subtle> : null}

      {/* ── accounts ─────────────────────────────────────────────────── */}
      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Shop accounts</Text>
        <Subtle>Everyone who can sign in to this shop&apos;s dashboard.</Subtle>

        {members?.length === 0 && (
          <EmptyState message="No accounts yet. Create one below." />
        )}
        {members?.map((member) => (
          <View
            key={member.profile_id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{member.full_name || 'Unnamed'}</Text>
              <Subtle>
                {member.phone} · {describeMemberRole(member.role)}
              </Subtle>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${member.full_name || member.phone}`}
              onPress={() => removeMember.mutate(member.profile_id)}
              disabled={removeMember.isPending}
            >
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {/* ── create a new account ─────────────────────────────────────── */}
      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Create shop account</Text>
        <Subtle>
          Creates a brand-new login for this shop. Hand over the mobile number and
          temporary password — they sign in with those straight away.
        </Subtle>

        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Maria Santos"
        />
        <PhoneField value={phone} onChangeText={setPhone} />

        <Field
          label="Temporary password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Subtle onPress={() => setPassword(generateTempPassword())}>
          Generate a new temporary password
        </Subtle>

        <RolePicker value={role} onChange={setRole} />

        <Button
          title={createAccount.isPending ? 'Creating…' : 'Create shop account'}
          onPress={() => createAccount.mutate()}
          disabled={createAccount.isPending}
        />
      </Card>

      {/* ── attach an existing account ───────────────────────────────── */}
      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Attach an existing account</Text>
        <Subtle>
          For someone who already signed up in the app. They keep their own password.
        </Subtle>
        <PhoneField
          label="Their mobile number"
          value={existingPhone}
          onChangeText={setExistingPhone}
        />
        <Button
          title={assignExisting.isPending ? 'Attaching…' : 'Attach to this shop'}
          onPress={() => assignExisting.mutate()}
          disabled={assignExisting.isPending}
          variant="outline"
        />
      </Card>

      {/* ── QR ───────────────────────────────────────────────────────── */}
      <Card>
        <Text style={{ fontWeight: '600' }}>Shop registration QR</Text>
        <Subtle>
          Print this for the counter — customers scan it to register with the shop.
        </Subtle>
        <View style={{ alignItems: 'center', padding: 12 }}>
          <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={200} />
        </View>
      </Card>

      {/* ── status ───────────────────────────────────────────────────── */}
      <Card>
        <Text style={{ fontWeight: '600' }}>
          {shop.is_active ? 'Shop is active' : 'Shop is inactive'}
        </Text>
        <Subtle>
          {shop.is_active
            ? 'Customers can scan the QR and register with this shop.'
            : 'New customers cannot register. Existing orders are untouched.'}
        </Subtle>
        <Button
          title={shop.is_active ? 'Deactivate shop' : 'Reactivate shop'}
          onPress={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
          variant={shop.is_active ? 'danger' : 'primary'}
        />
      </Card>
    </Screen>
  );
}

function RolePicker({
  value,
  onChange,
}: {
  value: ShopAccountRole;
  onChange: (role: ShopAccountRole) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtle }}>Role</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SHOP_ACCOUNT_ROLES.map((option) => {
          const isSelected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(option)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: isSelected ? '#FFFFFF' : colors.text,
                }}
              >
                {describeMemberRole(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
