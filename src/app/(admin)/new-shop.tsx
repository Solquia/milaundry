import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AdminHero,
  PillButton,
  ShopLogo,
  adminColors,
} from '@/components/admin-ui';
import { Field, PhoneField } from '@/components/ui-kit';
import {
  adminCreateBrandedOwner,
  adminCreateShop,
  adminUpdateShop,
  uploadShopLogo,
} from '@/lib/api';
import { friendlyAdminError } from '@/lib/domain/admin-error';
import { generateBrandedAccount } from '@/lib/domain/branded-account';
import { validateShopForm } from '@/lib/domain/shop-form';
import { slugifyShopName } from '@/lib/domain/shop-slug';

interface CreatedCredentials {
  shopId: string;
  shopName: string;
  username: string;
  password: string;
}

export default function NewShop() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUri, setLogoUri] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  const slug = slugifyShopName(name);

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

  const createShop = useMutation({
    mutationFn: async () => {
      const validated = validateShopForm({ name, address, phoneInput: phone });
      if (!validated.ok) throw new Error(validated.message);

      const shop = await adminCreateShop(validated.values, { slug });

      let logoUrl = '';
      if (logoUri) {
        logoUrl = await uploadShopLogo(shop.slug, logoUri);
        await adminUpdateShop(shop.id, validated.values, { logoUrl });
      }

      // The branded owner login is generated from the shop's own name.
      const account = generateBrandedAccount(validated.values.name);
      await adminCreateBrandedOwner(shop.id, {
        fullName: `${validated.values.name} Owner`,
        username: account.username,
        password: account.password,
      });

      return {
        shopId: shop.id,
        shopName: shop.name,
        username: account.username,
        password: account.password,
      };
    },
    onSuccess: (credentials) => {
      setError('');
      setCreated(credentials);
      queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
      queryClient.invalidateQueries({ queryKey: ['admin-account-count'] });
    },
    onError: (err: Error) => setError(friendlyAdminError(err.message, phone)),
  });

  if (created) {
    return (
      <View style={styles.screen}>
        <AdminHero title={created.shopName} subtitle="Shop created" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.successTitle}>Login ready to hand over</Text>
            <Text style={styles.credentialLine} selectable>
              Username: {created.username}
            </Text>
            <Text style={styles.credentialLine} selectable>
              Password: {created.password}
            </Text>
            <Text style={styles.note}>
              Send these to the shop privately — they can sign in right away and
              should change the password after. This is the only time the
              password is shown.
            </Text>
          </View>
          <PillButton
            title="Manage this shop"
            onPress={() => router.replace(`/(admin)/shop/${created.shopId}`)}
          />
          <PillButton
            title="Back to shops"
            variant="outline"
            onPress={() => router.replace('/(admin)/shops')}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminHero
        title="Add laundry shop"
        subtitle="Name, logo and location — the login is generated for you"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick a logo"
            onPress={pickLogo}
            style={styles.logoPicker}
          >
            <ShopLogo name={name || 'M'} logoUrl={logoUri || undefined} size={72} />
            <Text style={styles.logoHint}>
              {logoUri ? 'Change logo' : 'Add logo'}
            </Text>
          </Pressable>

          <Field
            label="Shop name"
            value={name}
            onChangeText={setName}
            placeholder="Sparkle Wash"
          />
          {slug ? <Text style={styles.slugPreview}>/{slug}</Text> : null}
          <Field
            label="Location"
            value={address}
            onChangeText={setAddress}
            placeholder="123 Rizal Ave, San Carlos City"
          />
          <PhoneField
            label="Contact number (optional)"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {name.trim() ? (
          <View style={styles.card}>
            <Text style={styles.previewLabel}>AUTO-GENERATED LOGIN</Text>
            <Text style={styles.previewText}>
              Username <Text style={styles.previewStrong}>{generatePreviewUsername(name)}</Text>{' '}
              and a branded password are created with the shop. You&apos;ll see
              them once, right after this.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PillButton
          title={createShop.isPending ? 'Creating…' : 'Create shop & account'}
          onPress={() => createShop.mutate()}
          disabled={createShop.isPending}
        />
        <PillButton title="Cancel" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

function generatePreviewUsername(name: string): string {
  return slugifyShopName(name).replace(/-/g, '').slice(0, 24) || 'laundry';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: adminColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 16,
    gap: 10,
  },
  logoPicker: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  logoHint: { color: adminColors.accent, fontWeight: '700', fontSize: 14 },
  slugPreview: { color: adminColors.subtle, fontSize: 13, marginTop: -4 },
  previewLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: adminColors.subtle,
  },
  previewText: { fontSize: 14, color: adminColors.text, lineHeight: 20 },
  previewStrong: { fontWeight: '800' },
  successTitle: { fontSize: 18, fontWeight: '800', color: adminColors.success },
  credentialLine: { fontSize: 16, color: adminColors.text, fontWeight: '600' },
  note: { fontSize: 13, color: adminColors.subtle, lineHeight: 18 },
  errorText: { color: adminColors.danger, fontSize: 14 },
});
