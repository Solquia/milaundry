import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  AdminHero,
  Chip,
  PillButton,
  ShopLogo,
  StatusBadgePill,
  ToggleRow,
  adminColors,
} from '@/components/admin-ui';
import { AdminShopServices } from '@/components/admin-shop-services';
import {
  ErrorText,
  Field,
  Loading,
  PasswordField,
  PhoneField,
  Subtle,
} from '@/components/ui-kit';
import {
  adminAssignMerchant,
  adminCreateShopAccount,
  adminListShopMembers,
  adminRemoveShopMember,
  adminSetShopActive,
  adminUpdateShop,
  getAllShops,
  setShopBranding,
  uploadBrandLogo,
  uploadShopCover,
} from '@/lib/api';
import { friendlyAdminError } from '@/lib/domain/admin-error';
import type { CredentialsHandoff } from '@/lib/domain/credentials-handoff';
import { credentialsHandoff } from '@/lib/domain/credentials-handoff';
import { formatPhoneInput } from '@/lib/domain/phone-input';
import { buildShopQr } from '@/lib/domain/qr';
import type { ShopAccountRole } from '@/lib/domain/shop-account';
import { SHOP_ACCOUNT_ROLES, validateShopAccountForm } from '@/lib/domain/shop-account';
import { validateShopForm } from '@/lib/domain/shop-form';
import { canRemoveMember, describeMemberRole } from '@/lib/domain/shop-member';
import { COVER_ASPECT, COVER_QUALITY, coverTooLarge, heroBackdrop } from '@/lib/domain/shop-cover';
import { generateTempPassword, type PasswordSource } from '@/lib/domain/temp-password';
import { useViewAsShop } from '@/lib/view-as-shop-context';

const SEGMENTS = ['General', 'Accounts', 'Services', 'Features', 'Integrations', 'Delivery'] as const;
type Segment = (typeof SEGMENTS)[number];

export default function AdminShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shopId = id!;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openShopAsMerchant } = useViewAsShop();

  const [segment, setSegment] = useState<Segment>('General');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const shop = shops?.find((candidate) => candidate.id === shopId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-shop-members', shopId] });
    queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
  };

  const report = (err: Error, contextPhone: string) => {
    setMessage('');
    setError(friendlyAdminError(err.message, contextPhone));
  };

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
    <View style={styles.screen}>
      <AdminHero eyebrow="‹ SHOPS" title={shop.name} subtitle={`/${shop.slug}`}>
        <View style={styles.heroBadgeRow}>
          <StatusBadgePill isActive={shop.is_active} />
        </View>
      </AdminHero>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {SEGMENTS.map((candidate) => (
              <Chip
                key={candidate}
                label={candidate}
                isSelected={segment === candidate}
                onPress={() => setSegment(candidate)}
              />
            ))}
          </View>
        </ScrollView>

        <ErrorText>{error}</ErrorText>
        {message ? <Subtle>{message}</Subtle> : null}

        {segment === 'General' && (
          <GeneralSegment
            shop={shop}
            onError={(err) => report(err, '')}
            onSaved={() => {
              setError('');
              setMessage('Shop details saved.');
              refresh();
            }}
            onToggleActive={() => toggleActive.mutate()}
            isTogglingActive={toggleActive.isPending}
            onOpenAsMerchant={() => {
              openShopAsMerchant(shop);
              router.push('/(merchant)/orders');
            }}
          />
        )}

        {segment === 'Accounts' && (
          <AccountsSegment
            shopId={shopId}
            onError={report}
            onMessage={(text) => {
              setError('');
              setMessage(text);
            }}
            refresh={refresh}
          />
        )}

        {segment === 'Services' && (
          <AdminShopServices
            shopId={shopId}
            onError={(err) => report(err, '')}
            onMessage={(text) => {
              setError('');
              setMessage(text);
            }}
          />
        )}

        {segment === 'Features' && (
          <View style={styles.card}>
            <ToggleRow
              title="Store active"
              description="Turning this off stops new customer registrations"
              value={shop.is_active}
              onToggle={() => toggleActive.mutate()}
            />
            <ToggleRow
              title="Order management"
              description="POS, order queue and status tracking"
              value
              disabled
            />
            <ToggleRow
              title="QR registration"
              description="Customers scan the counter QR to register"
              value
              disabled
            />
            <ToggleRow
              title="Analytics"
              description="Revenue, customers and status breakdown"
              value
              disabled
            />
            <ToggleRow
              title="Promotions"
              description="Coming soon — discounts and flash promos"
              value={false}
              disabled
            />
            <ToggleRow
              title="Loyalty points"
              description="Coming soon — reward repeat customers"
              value={false}
              disabled
            />
          </View>
        )}

        {segment === 'Integrations' && (
          <View style={styles.card}>
            <ToggleRow
              title="Messenger"
              description="Coming soon — order updates via Messenger"
              value={false}
              disabled
            />
            <ToggleRow
              title="GCash payments"
              description="Coming soon — collect payments in-app"
              value={false}
              disabled
            />
            <ToggleRow
              title="SMS notifications"
              description="Coming soon — text customers when orders are ready"
              value={false}
              disabled
            />
            <ToggleRow
              title="Email notifications"
              description="Coming soon — email the owner on each new order"
              value={false}
              disabled
            />
          </View>
        )}

        {segment === 'Delivery' && (
          <View style={styles.card}>
            <ToggleRow
              title="Lalamove"
              description="Coming soon — book couriers through Lalamove"
              value={false}
              disabled
            />
            <ToggleRow
              title="Distance-based fee"
              description="Coming soon — charge pickup/delivery by distance"
              value={false}
              disabled
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── General ────────────────────────────────────────────────────────────────
function GeneralSegment({
  shop,
  onError,
  onSaved,
  onToggleActive,
  isTogglingActive,
  onOpenAsMerchant,
}: {
  shop: {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    cover_url: string;
    brand_accent: number | null;
    tagline: string;
    address: string;
    phone: string;
    qr_token: string;
    is_active: boolean;
  };
  onError: (err: Error) => void;
  onSaved: () => void;
  onToggleActive: () => void;
  isTogglingActive: boolean;
  onOpenAsMerchant: () => void;
}) {
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address);
  const [phoneInput, setPhoneInput] = useState(formatPhoneInput(shop.phone));
  const [logoUri, setLogoUri] = useState('');
  const [coverUri, setCoverUri] = useState('');
  const [coverError, setCoverError] = useState('');

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const pickCover = async () => {
    setCoverError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: COVER_ASPECT,
      quality: COVER_QUALITY,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (coverTooLarge(asset.fileSize)) {
      setCoverError('That photo is too large. Pick one under 6 MB.');
      return;
    }
    setCoverUri(asset.uri);
  };

  const save = useMutation({
    mutationFn: async () => {
      const validated = validateShopForm({ name, address, phoneInput });
      if (!validated.ok) throw new Error(validated.message);
      let logoUrl: string | undefined;
      if (logoUri) logoUrl = await uploadBrandLogo(shop.id, logoUri);
      await adminUpdateShop(shop.id, validated.values, { logoUrl });
      if (coverUri) {
        const coverUrl = await uploadShopCover(shop.id, coverUri);
        await setShopBranding(shop.id, {
          accent: shop.brand_accent,
          tagline: shop.tagline ?? '',
          coverUrl,
        });
      }
    },
    onSuccess: () => {
      setLogoUri('');
      setCoverUri('');
      onSaved();
    },
    onError,
  });

  const backdrop = heroBackdrop(shop, coverUri);

  return (
    <>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change background photo"
          onPress={pickCover}
          style={styles.coverPicker}
        >
          {backdrop.kind === 'photo' ? (
            <Image
              source={{ uri: backdrop.uri }}
              style={styles.coverImage}
              contentFit="cover"
              accessibilityLabel={`Background photo of ${shop.name}`}
            />
          ) : (
            <View style={styles.coverEmpty}>
              <Text style={styles.logoHint}>Add background photo</Text>
            </View>
          )}
          <Text style={styles.logoHint}>
            {coverUri ? 'New photo ready — save to publish' : 'Change background photo'}
          </Text>
        </Pressable>
        {coverError ? <ErrorText>{coverError}</ErrorText> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change logo"
          onPress={pickLogo}
          style={styles.logoPicker}
        >
          <ShopLogo
            name={shop.name}
            logoUrl={logoUri || shop.logo_url || undefined}
            size={72}
          />
          <Text style={styles.logoHint}>Change logo</Text>
        </Pressable>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Location" value={address} onChangeText={setAddress} />
        <PhoneField
          label="Contact number (optional)"
          value={phoneInput}
          onChangeText={setPhoneInput}
        />
        <PillButton
          title={save.isPending ? 'Saving…' : 'Save changes'}
          onPress={() => save.mutate()}
          disabled={save.isPending}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registration QR</Text>
        <Subtle>Print for the counter — customers scan it to register.</Subtle>
        <View style={{ alignItems: 'center', padding: 12 }}>
          <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={180} />
        </View>
      </View>

      <PillButton title="Open as merchant ↗" variant="outline" onPress={onOpenAsMerchant} />
      <PillButton
        title={
          isTogglingActive
            ? 'Working…'
            : shop.is_active
              ? 'Deactivate shop'
              : 'Reactivate shop'
        }
        variant={shop.is_active ? 'danger' : 'filled'}
        onPress={onToggleActive}
        disabled={isTogglingActive}
      />
    </>
  );
}

// ── Accounts ───────────────────────────────────────────────────────────────
function AccountsSegment({
  shopId,
  onError,
  onMessage,
  refresh,
}: {
  shopId: string;
  onError: (err: Error, contextPhone: string) => void;
  onMessage: (text: string) => void;
  refresh: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [passwordSource, setPasswordSource] = useState<PasswordSource>('generate');
  const [password, setPassword] = useState(() => generateTempPassword());
  const [role, setRole] = useState<ShopAccountRole>('staff');
  const [existingPhone, setExistingPhone] = useState('');
  const [handoff, setHandoff] = useState<CredentialsHandoff | null>(null);

  const { data: members } = useQuery({
    queryKey: ['admin-shop-members', shopId],
    queryFn: () => adminListShopMembers(shopId),
  });

  const createAccount = useMutation({
    mutationFn: () => {
      const result = validateShopAccountForm({ fullName, phoneInput: phone, password, role });
      if (!result.ok) return Promise.reject(new Error(result.message));
      return adminCreateShopAccount(shopId, result.account).then(() => result.account);
    },
    onSuccess: (account) => {
      setHandoff(
        credentialsHandoff({
          fullName: account.fullName,
          phone: account.phone,
          password: account.password,
        })
      );
      setFullName('');
      setPhone('');
      setPassword(passwordSource === 'generate' ? generateTempPassword() : '');
      onMessage('');
      refresh();
    },
    onError: (err: Error) => onError(err, phone),
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
      onMessage('Existing account attached to this shop.');
      setExistingPhone('');
      refresh();
    },
    onError: (err: Error) => onError(err, existingPhone),
  });

  const removeMember = useMutation({
    mutationFn: (profileId: string) => {
      const check = canRemoveMember(members ?? [], profileId);
      if (!check.ok) return Promise.reject(new Error(check.reason));
      return adminRemoveShopMember(shopId, profileId);
    },
    onSuccess: () => {
      onMessage('Account removed from this shop.');
      refresh();
    },
    onError: (err: Error) => onError(err, ''),
  });

  return (
    <>
      {handoff && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: adminColors.success }]}>
            {handoff.title}
          </Text>
          {handoff.lines.map((line) => (
            <Text key={line} selectable style={styles.credentialLine}>
              {line}
            </Text>
          ))}
          <Subtle>{handoff.note}</Subtle>
          <Subtle onPress={() => setHandoff(null)}>Dismiss</Subtle>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shop accounts</Text>
        <Subtle>Everyone who can sign in to this shop&apos;s dashboard.</Subtle>
        {members?.length === 0 && <Subtle>No accounts yet. Create one below.</Subtle>}
        {members?.map((member) => (
          <View key={member.profile_id} style={styles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.full_name || 'Unnamed'}</Text>
              <Subtle>
                {member.username || member.phone} · {describeMemberRole(member.role)}
              </Subtle>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${member.full_name || member.username || member.phone}`}
              onPress={() => removeMember.mutate(member.profile_id)}
              disabled={removeMember.isPending}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add staff by mobile number</Text>
        <Subtle>
          Creates another login for this shop. Hand over the number and password.
        </Subtle>
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Maria Santos"
        />
        <PhoneField value={phone} onChangeText={setPhone} />
        <Subtle>Password</Subtle>
        <View style={styles.roleRow}>
          <Chip
            label="Generate"
            isSelected={passwordSource === 'generate'}
            onPress={() => {
              setPasswordSource('generate');
              setPassword(generateTempPassword());
            }}
          />
          <Chip
            label="Type my own"
            isSelected={passwordSource === 'choose'}
            onPress={() => {
              setPasswordSource('choose');
              setPassword('');
            }}
          />
        </View>
        {passwordSource === 'generate' ? (
          <>
            <Text selectable style={styles.credentialLine}>
              {password}
            </Text>
            <Subtle onPress={() => setPassword(generateTempPassword())}>
              Make another easy password
            </Subtle>
          </>
        ) : (
          <PasswordField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
          />
        )}
        <View style={styles.roleRow}>
          {SHOP_ACCOUNT_ROLES.map((option) => (
            <Chip
              key={option}
              label={describeMemberRole(option)}
              isSelected={role === option}
              onPress={() => setRole(option)}
            />
          ))}
        </View>
        <PillButton
          title={createAccount.isPending ? 'Creating…' : 'Create account'}
          onPress={() => createAccount.mutate()}
          disabled={createAccount.isPending}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attach an existing account</Text>
        <Subtle>For someone who already signed up. They keep their password.</Subtle>
        <PhoneField
          label="Their mobile number"
          value={existingPhone}
          onChangeText={setExistingPhone}
        />
        <PillButton
          title={assignExisting.isPending ? 'Attaching…' : 'Attach to this shop'}
          variant="outline"
          onPress={() => assignExisting.mutate()}
          disabled={assignExisting.isPending}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  heroBadgeRow: { flexDirection: 'row', marginTop: 10 },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  card: {
    backgroundColor: adminColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: adminColors.text },
  logoPicker: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  logoHint: { color: adminColors.accent, fontWeight: '700', fontSize: 14 },
  coverPicker: { gap: 8 },
  coverImage: { width: '100%', height: 140, borderRadius: 12 },
  coverEmpty: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.paper,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: adminColors.border,
  },
  memberName: { fontWeight: '700', color: adminColors.text },
  removeText: { color: adminColors.danger, fontWeight: '700' },
  roleRow: { flexDirection: 'row', gap: 8 },
  credentialLine: { fontSize: 15, color: adminColors.text, fontWeight: '600' },
});
