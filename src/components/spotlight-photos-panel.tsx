/**
 * The spotlight's one extra choice: whose photo each service wears.
 *
 * Out of the box every product card shows one of the app's own cut-outs,
 * picked from the service's name and shot to match the rest of the set. An
 * owner with photos of their own work can put theirs on any service instead,
 * and take it back off again ("Use ours"). Drawn inside the spotlight option
 * of the storefront-look card, because it only means anything there.
 *
 * Saved at once, per service, the way the look itself is: the upload goes to
 * the shop's own folder and the URL onto the service row (0042).
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ServicePhoto } from './service-photo';
import { ACCENTS, ErrorText, RADII, colors, space, type } from './ui-kit';
import { clearServiceImage, getServices, uploadServiceImage } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTitle } from '@/lib/domain/service-showcase';
import { coverTooLarge } from '@/lib/domain/shop-cover';
import { ownImage } from '@/lib/domain/spotlight';
import type { ServiceRow } from '@/lib/types';

type Accent = (typeof ACCENTS)[number];

interface SaveRequest {
  service: ServiceRow;
  /** A picked photo to upload; null puts the app's cut-out back. */
  uri: string | null;
}

export function SpotlightPhotosPanel({ shopId, accent }: { shopId: string; accent: Accent }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const services = useQuery({ queryKey: ['services', shopId], queryFn: () => getServices(shopId) });

  const save = useMutation({
    mutationFn: ({ service, uri }: SaveRequest) =>
      uri ? uploadServiceImage(shopId, service.id, uri) : clearServiceImage(service.id),
    onSuccess: async () => {
      setError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', shopId] }),
        queryClient.invalidateQueries({ queryKey: ['service-images', shopId] }),
      ]);
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-branding', err.message)),
  });
  const busyId = save.isPending ? save.variables?.service.id : null;

  const pick = async (service: ServiceRow) => {
    setError('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Square, because every card, circle and sheet shows it square.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (coverTooLarge(asset.fileSize)) {
      setError('That photo is too large. Pick one under 6 MB.');
      return;
    }
    save.mutate({ service, uri: asset.uri });
  };

  const rows = services.data ?? [];
  const ownCount = rows.filter((row) => ownImage(row)).length;

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Ionicons name="images-outline" size={18} color={accent.ink} />
        <View style={styles.headWords}>
          <Text style={styles.title}>Service photos</Text>
          <Text style={styles.caption}>
            Use our matching photo set, or upload your own for any service. Square photos of one item on a
            plain background look best.
          </Text>
        </View>
      </View>

      {services.isLoading ? <ActivityIndicator color={accent.ink} /> : null}
      {rows.length > 0 ? (
        <Text style={styles.count}>
          {ownCount === 0
            ? 'All services use our photos'
            : `${ownCount} of ${rows.length} use your photos`}
        </Text>
      ) : null}

      {rows.map((service) => {
        const own = ownImage(service);
        const isBusy = busyId === service.id;
        return (
          <View key={service.id} style={styles.row}>
            <ServicePhoto
              photo={sceneFor(service.name, service.category)}
              uri={own}
              style={[styles.thumb, { backgroundColor: accent.surface }]}
            />
            <View style={styles.words}>
              <Text style={styles.name} numberOfLines={1}>
                {showcaseTitle(service.name)}
              </Text>
              <Text style={styles.source}>{own ? 'Your photo' : 'Our photo'}</Text>
            </View>
            {isBusy ? (
              <ActivityIndicator color={accent.ink} />
            ) : (
              <View style={styles.actions}>
                {own ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use our photo for ${service.name}`}
                    disabled={save.isPending}
                    onPress={() => save.mutate({ service, uri: null })}
                    hitSlop={6}
                    style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
                  >
                    <Text style={styles.ghostText}>Use ours</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${own ? 'Change' : 'Upload'} the photo for ${service.name}`}
                  disabled={save.isPending}
                  onPress={() => void pick(service)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.upload,
                    { backgroundColor: accent.ink },
                    save.isPending && styles.off,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={own ? 'swap-horizontal' : 'cloud-upload-outline'} size={14} color={colors.onAccent} />
                  <Text style={styles.uploadText}>{own ? 'Change' : 'Upload'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.snug,
    padding: space.cosy,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', gap: space.snug, alignItems: 'flex-start' },
  headWords: { flex: 1, gap: 2 },
  title: { ...type.label, color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  count: { ...type.caption, color: colors.subtle, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingTop: space.snug,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  thumb: { width: 48, height: 48, borderRadius: RADII.chip },
  words: { flex: 1, gap: 1 },
  name: { ...type.label, fontSize: 13.5, color: colors.text },
  source: { ...type.caption, fontSize: 12, color: colors.subtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  ghost: { paddingHorizontal: space.tight, paddingVertical: space.tight },
  ghostText: { ...type.caption, color: colors.subtle, fontWeight: '600' },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.snug + 2,
    height: 30,
    borderRadius: RADII.pill,
  },
  uploadText: { ...type.caption, fontWeight: '700', color: colors.onAccent },
  pressed: { opacity: 0.8 },
  off: { opacity: 0.5 },
});
