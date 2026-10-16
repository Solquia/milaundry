/**
 * The receipt photo on an expense: add one, see it, change it, take it off.
 *
 * A photo just picked shows from the phone; a saved one is fetched through a
 * short-lived signed link, because the bucket is private (0040). Optional
 * everywhere — most detergent runs have no receipt worth keeping.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { expenseReceiptUrl } from '@/lib/api';

import { GLASS_FILL_DENSE } from './glass';
import { RADII, colors, space, type } from './ui-kit';

const RECEIPT_QUALITY = 0.6;

export function ReceiptField({
  localUri,
  savedPath,
  onPick,
  onRemove,
}: {
  /** A photo picked in this sheet, not yet uploaded. */
  localUri: string | null;
  /** The receipt already on the expense. */
  savedPath: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
}) {
  const { data: savedUrl, isError } = useQuery({
    queryKey: ['expense-receipt', savedPath],
    queryFn: () => expenseReceiptUrl(savedPath!),
    enabled: Boolean(savedPath) && !localUri,
    // The link lasts an hour; refetch well before it lapses.
    staleTime: 30 * 60 * 1000,
  });

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: RECEIPT_QUALITY,
    });
    if (!picked.canceled && picked.assets[0]) onPick(picked.assets[0].uri);
  };

  const source = localUri ?? savedUrl ?? null;
  const hasReceipt = Boolean(localUri || savedPath);

  if (!hasReceipt) {
    return (
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="camera-outline" size={18} color={colors.actionInk} />
        <Text style={styles.addText}>Add receipt photo (optional)</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      {source ? (
        <Image source={{ uri: source }} style={styles.thumb} contentFit="cover" accessibilityLabel="Receipt photo" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name={isError ? 'alert-circle-outline' : 'receipt-outline'} size={22} color={colors.subtle} />
        </View>
      )}
      <View style={styles.actions}>
        <Text style={styles.caption}>{localUri ? 'Saved with the expense' : 'Receipt on file'}</Text>
        <View style={styles.links}>
          <Pressable onPress={pick} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Change</Text>
          </Pressable>
          <Pressable onPress={onRemove} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: colors.dangerInk }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  addText: { ...type.label, color: colors.actionInk },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  thumb: { width: 64, height: 64, borderRadius: RADII.chip, backgroundColor: GLASS_FILL_DENSE },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  actions: { flex: 1, gap: space.tight },
  caption: { ...type.caption, color: colors.subtle },
  links: { flexDirection: 'row', gap: space.room },
  link: { ...type.label, color: colors.actionInk },
});
