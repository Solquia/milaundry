/**
 * The counter moment: the load goes on the scale and the price stops being
 * a guess.
 *
 * Everything here is arranged around one obligation — the customer is not in
 * the room, and a number is about to change on their phone. So the reading, the
 * photo that justifies it, and the sentence naming the difference all sit
 * together above the button, and the button says what the customer will get
 * rather than what the database will do.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WeightScale } from '@/components/quantity-picker';
import {
  Button,
  ErrorText,
  Field,
  Subtle,
  colors,
  formatMoney,
  space,
  type,
} from '@/components/ui-kit';
import { getServices, weighOrder, type OrderWithDetails } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  MAX_SCALE_KG,
  canWeigh,
  describeWeighChange,
  parseWeight,
  recomputeForWeight,
  type WeighLine,
} from '@/lib/domain/weigh-order';

interface WeighSheetProps {
  order: OrderWithDetails;
  /** Fired once the server has accepted the weighing. */
  onWeighed: () => void;
}

export function WeighSheet({ order, onWeighed }: WeighSheetProps) {
  const queryClient = useQueryClient();
  const [reading, setReading] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Shares the booking screen's cache key: order_items carry no min_quantity,
  // and without it a below-minimum load would preview at a price the server
  // would then correct — the one surprise this whole screen exists to avoid.
  const { data: services } = useQuery({
    queryKey: ['services', order.shop_id],
    queryFn: () => getServices(order.shop_id),
  });

  const lines: WeighLine[] = useMemo(
    () =>
      order.order_items
        // A line whose service was deleted from the catalogue keeps its price
        // on the receipt but can no longer be re-priced from a scale, since
        // there is nothing left to look the per-kilo rate up in.
        .filter((item): item is typeof item & { service_id: string } =>
          Boolean(item.service_id)
        )
        .map((item) => {
          const service = services?.find((row) => row.id === item.service_id);
          return {
            serviceId: item.service_id,
            serviceName: item.service_name,
            unit: item.unit,
            unitPrice: service?.price ?? item.unit_price,
            minQuantity: service?.min_quantity ?? 0,
            quantity: item.quantity,
          };
        }),
    [order.order_items, services]
  );

  /** The one line a scale reading can apply to. */
  const weighedLine = lines.find((line) => line.unit === 'per_kg');
  const weightKg = parseWeight(reading);

  const preview = useMemo(() => {
    if (!weighedLine || weightKg === null) return null;
    try {
      return recomputeForWeight(lines, weighedLine.serviceId, weightKg);
    } catch {
      // A catalogue that shifted under us is not worth a crash at the counter;
      // the server will reject the same weighing with a readable reason.
      return null;
    }
  }, [lines, weighedLine, weightKg]);

  const mutation = useMutation({
    mutationFn: () =>
      weighOrder(order.id, {
        serviceId: weighedLine!.serviceId,
        weightKg: weightKg!,
        photoUri,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      setReading('');
      setPhotoUri(null);
      onWeighed();
    },
    // 'save-price' is precisely what a failed weighing is, so it reuses that
    // fallback rather than adding a near-identical action beside it.
    onError: (err: Error) => setError(friendlyMerchantError('save-price', err.message)),
  });

  const takePhoto = async () => {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      // Not a dead end: an online booking still needs evidence, so offer the
      // library rather than stranding an owner who denied the camera once.
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
      });
      if (!picked.canceled) setPhotoUri(picked.assets[0].uri);
      return;
    }

    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!shot.canceled) setPhotoUri(shot.assets[0].uri);
  };

  if (!canWeigh(order)) return null;
  if (!weighedLine) {
    return <Subtle>Nothing on this order is sold by weight.</Subtle>;
  }

  // An online customer never saw the scale. The photo is the only thing
  // standing behind a number that moved, so it is not optional for them.
  const isPhotoRequired = order.order_type === 'online';
  const isMissingPhoto = isPhotoRequired && !photoUri;
  const difference = preview
    ? describeWeighChange(order.estimated_total, preview.total)
    : null;

  return (
    <View style={styles.sheet}>
      <Text style={styles.heading}>Weigh the load</Text>
      <Subtle>
        {weighedLine.serviceName} at {formatMoney(weighedLine.unitPrice)}/kg
        {weighedLine.minQuantity > 0
          ? ` · ${weighedLine.minQuantity} kg minimum`
          : ''}
      </Subtle>

      <WeightScale
        valueKg={weightKg ?? 0}
        onChange={(kg) => setReading(String(kg))}
      />
      <Field
        label="Or type what the scale reads"
        value={reading}
        onChangeText={setReading}
        placeholder={`e.g. 7.5 — up to ${MAX_SCALE_KG} kg`}
        keyboardType="decimal-pad"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photoUri ? 'Retake the photo' : 'Photograph the load'}
        onPress={takePhoto}
        style={styles.photoBox}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="camera-outline" size={22} color={colors.actionInk} />
            <Text style={styles.photoLabel}>
              {isPhotoRequired ? 'Photo of the load on the scale' : 'Add a photo (optional)'}
            </Text>
          </View>
        )}
      </Pressable>

      {preview && (
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Actual total</Text>
          <Text style={styles.previewValue}>{formatMoney(preview.total)}</Text>
        </View>
      )}
      {preview?.isAtMinimum && (
        <Text style={styles.notice}>
          Under the {weighedLine.minQuantity} kg minimum — billed at the minimum.
        </Text>
      )}
      {difference && <Text style={styles.difference}>{difference}</Text>}
      {isMissingPhoto && (
        <Subtle>A photo is required before an online booking can be repriced.</Subtle>
      )}

      <ErrorText>{error}</ErrorText>
      <Button
        title={mutation.isPending ? 'Sending…' : 'Confirm price & notify customer'}
        disabled={weightKg === null || isMissingPhoto || mutation.isPending}
        onPress={() => {
          setError('');
          mutation.mutate();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.snug },
  heading: { ...type.section, color: colors.text },

  /** 16:9-ish, so a phone photo of a scale reads without being tapped open. */
  photoBox: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.tight },
  photoLabel: { ...type.label, color: colors.actionInk },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  previewLabel: { ...type.label, color: colors.subtle },
  previewValue: { ...type.title, color: colors.text },
  notice: { ...type.body, fontWeight: '600', color: colors.primaryDark },
  /** The sentence that will reach the customer, in the colour of a warning. */
  difference: { ...type.body, fontWeight: '600', color: colors.actionInk },
});
