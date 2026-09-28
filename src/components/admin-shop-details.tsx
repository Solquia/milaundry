import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PanelCard } from '@/components/admin-pulse';
import { PillButton, ShopLogo, ToggleRow, adminColors } from '@/components/admin-ui';
import { ErrorText, Field, PhoneField } from '@/components/ui-kit';
import { adminUpdateShop, setShopBranding, uploadBrandLogo, uploadShopCover } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { deactivateShopPrompt } from '@/lib/domain/confirm-prompts';
import { formatPhoneInput } from '@/lib/domain/phone-input';
import { buildShopQr } from '@/lib/domain/qr';
import { COVER_ASPECT, COVER_QUALITY, coverTooLarge, heroBackdrop } from '@/lib/domain/shop-cover';
import { validateShopForm } from '@/lib/domain/shop-form';
import type { Shop } from '@/lib/types';

/** What the platform will add next, in one quiet list instead of dead switches. */
const ROADMAP = [
  'Promotions',
  'Loyalty points',
  'Messenger updates',
  'GCash in-app',
  'SMS alerts',
  'Email alerts',
  'Lalamove couriers',
  'Distance-based fees',
];

type Props = {
  shop: Shop;
  onError: (err: Error) => void;
  onSaved: (message: string) => void;
  onToggleActive: () => void;
  isTogglingActive: boolean;
};

export function AdminShopDetails({ shop, onError, onSaved, onToggleActive, isTogglingActive }: Props) {
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address);
  const [phoneInput, setPhoneInput] = useState(formatPhoneInput(shop.phone));
  const [logoUri, setLogoUri] = useState('');
  const [coverUri, setCoverUri] = useState('');
  const [coverError, setCoverError] = useState('');

  const isDirty =
    name !== shop.name ||
    address !== shop.address ||
    phoneInput !== formatPhoneInput(shop.phone) ||
    Boolean(logoUri) ||
    Boolean(coverUri);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setLogoUri(result.assets[0].uri);
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
      const logoUrl = logoUri ? await uploadBrandLogo(shop.id, logoUri) : undefined;
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
      onSaved('Shop details saved.');
    },
    onError,
  });

  const handleToggle = () => {
    if (shop.is_active) {
      confirmAction(deactivateShopPrompt(shop.name), onToggleActive);
      return;
    }
    onToggleActive();
  };

  const backdrop = heroBackdrop(shop, coverUri);

  return (
    <>
      <PanelCard title="Storefront" hint="What customers see at the top of the shop's page.">
        <View style={styles.cover}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change background photo"
            onPress={pickCover}
            style={StyleSheet.absoluteFill}
          >
            {backdrop.kind === 'photo' ? (
              <Image
                source={{ uri: backdrop.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel={`Background photo of ${shop.name}`}
              />
            ) : (
              <View style={styles.coverEmpty}>
                <Ionicons name="image-outline" size={22} color={adminColors.subtle} />
                <Text style={styles.coverEmptyText}>Add a background photo</Text>
              </View>
            )}
          </Pressable>
          <View pointerEvents="none" style={styles.coverChip}>
            <Ionicons name="camera-outline" size={14} color={adminColors.onHero} />
            <Text style={styles.coverChipText}>{coverUri ? 'New photo' : 'Change'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change logo"
            onPress={pickLogo}
            style={styles.logoRing}
          >
            <ShopLogo name={shop.name} logoUrl={logoUri || shop.logo_url || undefined} size={60} />
            <View style={styles.logoBadge}>
              <Ionicons name="pencil" size={11} color={adminColors.onHero} />
            </View>
          </Pressable>
        </View>
        {coverError ? <ErrorText>{coverError}</ErrorText> : null}
      </PanelCard>

      <PanelCard title="Details">
        <Field label="Shop name" value={name} onChangeText={setName} />
        <Field label="Location" value={address} onChangeText={setAddress} />
        <PhoneField label="Contact number (optional)" value={phoneInput} onChangeText={setPhoneInput} />
        <PillButton
          title={save.isPending ? 'Saving…' : isDirty ? 'Save changes' : 'No changes to save'}
          onPress={() => save.mutate()}
          disabled={save.isPending || !isDirty}
        />
      </PanelCard>

      <PanelCard>
        <ToggleRow
          title={shop.is_active ? 'Taking bookings' : 'Switched off'}
          description={
            shop.is_active
              ? 'Customers can find and book this shop.'
              : 'Hidden from customers. Switch on to take bookings again.'
          }
          value={shop.is_active}
          onToggle={handleToggle}
          disabled={isTogglingActive}
        />
      </PanelCard>

      <PanelCard title="Counter QR" hint="Print it for the counter. Customers scan it to join the shop.">
        <View style={styles.qrWrap}>
          <QRCode value={buildShopQr(shop.id, shop.qr_token)} size={148} />
        </View>
      </PanelCard>

      <PanelCard title="Coming soon" hint="Not switched on for any shop yet.">
        <View style={styles.roadmap}>
          {ROADMAP.map((item) => (
            <View key={item} style={styles.roadmapChip}>
              <Text style={styles.roadmapText}>{item}</Text>
            </View>
          ))}
        </View>
      </PanelCard>
    </>
  );
}

const COVER_HEIGHT = 150;

const styles = StyleSheet.create({
  cover: {
    height: COVER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: adminColors.paper,
  },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverEmptyText: { fontSize: 13, fontWeight: '600', color: adminColors.subtle },
  coverChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(8,24,56,0.55)',
  },
  coverChipText: { fontSize: 12, fontWeight: '600', color: adminColors.onHero },
  logoRing: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    padding: 3,
    borderRadius: 20,
    backgroundColor: adminColors.card,
  },
  logoBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: adminColors.action,
    borderWidth: 2,
    borderColor: adminColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: { alignItems: 'center', paddingVertical: 4 },
  roadmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roadmapChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: adminColors.paper,
  },
  roadmapText: { fontSize: 12, fontWeight: '600', color: adminColors.subtle },
});
