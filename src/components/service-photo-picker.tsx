/**
 * The photo buttons under a service's preview tile in its edit form: upload
 * the shop's own picture, or go back to our cut-out ("Use our photo").
 *
 * Saved at once, apart from the price form's Save, the way the storefront
 * photos panel saves (0042): the file goes to the shop's own folder and the
 * URL onto the service row, so the New Order tiles and the customer page
 * change straight away. A new service has no row yet, so it asks for a save first.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText, RADII, colors, fontFor, space, type } from './ui-kit';
import { clearServiceImage, uploadServiceImage } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { coverTooLarge } from '@/lib/domain/shop-cover';
import { ownImage } from '@/lib/domain/spotlight';
import type { ServiceRow } from '@/lib/types';

type ServicePhotoPickerProps = {
  shopId: string;
  /** Absent while adding a new service. */
  service?: ServiceRow;
  /** The URL now on the service ('' for our cut-out). */
  imageUrl: string;
  onChange: (imageUrl: string) => void;
};

export function ServicePhotoPicker({ shopId, service, imageUrl, onChange }: ServicePhotoPickerProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: ({ target, uri }: { target: ServiceRow; uri: string | null }) =>
      uri ? uploadServiceImage(shopId, target.id, uri) : clearServiceImage(target.id),
    onSuccess: async (saved) => {
      setError('');
      onChange(saved.image_url ?? '');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', shopId] }),
        queryClient.invalidateQueries({ queryKey: ['service-images', shopId] }),
      ]);
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-branding', err.message)),
  });

  if (!service) {
    return <Text style={styles.help}>Save this service first, then you can add its photo.</Text>;
  }

  const pick = async () => {
    setError('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Square, because every tile, circle and sheet shows it square.
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
    save.mutate({ target: service, uri: asset.uri });
  };

  const hasOwn = ownImage({ image_url: imageUrl }) !== null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.help}>
        {hasOwn ? 'Showing your photo.' : 'Showing our photo.'} Photo changes save right away.
      </Text>
      {save.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${hasOwn ? 'Change' : 'Upload'} the photo for ${service.name}`}
            onPress={() => void pick()}
            style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
          >
            <Ionicons name={hasOwn ? 'swap-horizontal' : 'cloud-upload-outline'} size={15} color={colors.onAccent} />
            <Text style={styles.uploadText}>{hasOwn ? 'Change photo' : 'Upload photo'}</Text>
          </Pressable>
          {hasOwn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use our photo for ${service.name}`}
              onPress={() => save.mutate({ target: service, uri: null })}
              hitSlop={6}
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            >
              <Text style={styles.ghostText}>Use our photo</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.snug },
  help: { ...type.caption, color: colors.subtle },
  spinner: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.snug },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.cosy,
    height: 34,
    borderRadius: RADII.pill,
    backgroundColor: colors.primary,
  },
  uploadText: { ...type.caption, ...fontFor(700), color: colors.onAccent },
  ghost: { paddingHorizontal: space.tight, paddingVertical: space.tight },
  ghostText: { ...type.caption, ...fontFor(600), color: colors.subtle },
  pressed: { opacity: 0.8 },
});
