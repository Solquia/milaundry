/**
 * The counter checks the booking against the bag, line by line.
 *
 * Replaces the weigh sheet, which could only re-price a per-kilo line: an
 * online booking of comforters and bedsheets had no way to get an actual
 * price, so its customer could never pay online. Here every line is on the
 * sheet — a scale reading for what is sold by the kilo, a − n + count for
 * what is sold by the piece — beside the photo that backs the number and the
 * sentence the customer will read. The button says what the customer gets.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, ErrorText, Subtle, colors, formatMoney, space, type } from '@/components/ui-kit';
import { confirmOrderPrice, getServices, type OrderWithDetails } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  checkLineSubtotal,
  checkTotal,
  quantityError,
  quantityFor,
  type CheckLine,
} from '@/lib/domain/price-check';
import { describeWeighChange, parseWeight } from '@/lib/domain/weigh-order';

interface PriceCheckSheetProps {
  order: OrderWithDetails;
  /** Fired once the server has accepted the price. */
  onConfirmed: () => void;
}

function Counter({
  line,
  value,
  onChange,
}: {
  line: CheckLine;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.counter}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`One less ${line.name}`}
        onPress={() => onChange(Math.max(0, value - 1))}
        hitSlop={6}
        style={styles.countKey}
      >
        <Ionicons name="remove" size={18} color={colors.actionInk} />
      </Pressable>
      <Text style={styles.countValue} accessibilityLabel={`${value} ${line.name}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`One more ${line.name}`}
        onPress={() => onChange(value + 1)}
        hitSlop={6}
        style={styles.countKey}
      >
        <Ionicons name="add" size={18} color={colors.actionInk} />
      </Pressable>
    </View>
  );
}

function LineRow({
  line,
  quantities,
  kgText,
  onPieces,
  onKg,
}: {
  line: CheckLine;
  quantities: Record<string, number>;
  kgText: string;
  onPieces: (next: number) => void;
  onKg: (text: string) => void;
}) {
  const quantity = quantityFor(line, quantities);
  const isChanged = quantity !== line.bookedQuantity;
  const isRemoved = line.unit !== 'per_kg' && quantity === 0;
  return (
    <View style={styles.line}>
      <View style={styles.lineText}>
        <Text style={[styles.lineName, isRemoved && styles.removed]} numberOfLines={2}>
          {line.name}
        </Text>
        <Text style={styles.lineMeta}>
          {formatMoney(line.unitPrice)}
          {line.unit === 'per_kg' ? '/kg' : ' each'} · booked {line.bookedQuantity}
          {line.unit === 'per_kg' ? ' kg' : ''}
          {isChanged ? ` → ${formatMoney(checkLineSubtotal(line, quantity))}` : ''}
        </Text>
      </View>
      {line.unit === 'per_kg' ? (
        <View style={styles.kgBox}>
          <TextInput
            value={kgText}
            onChangeText={onKg}
            placeholder={String(line.bookedQuantity)}
            placeholderTextColor={colors.subtle}
            keyboardType="decimal-pad"
            accessibilityLabel={`Weight of ${line.name} in kilos`}
            style={styles.kgInput}
          />
          <Text style={styles.kgUnit}>kg</Text>
        </View>
      ) : (
        <Counter line={line} value={quantity} onChange={onPieces} />
      )}
    </View>
  );
}

export function PriceCheckSheet({ order, onConfirmed }: PriceCheckSheetProps) {
  const queryClient = useQueryClient();
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [kgTexts, setKgTexts] = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Shares the booking screen's cache key: order_items carry no min_quantity.
  const { data: services } = useQuery({
    queryKey: ['services', order.shop_id],
    queryFn: () => getServices(order.shop_id),
  });

  const lines: CheckLine[] = useMemo(
    () =>
      order.order_items.map((item) => ({
        itemId: item.id,
        name: item.service_name,
        unit: item.unit,
        unitPrice: item.unit_price,
        minQuantity: services?.find((row) => row.id === item.service_id)?.min_quantity ?? 0,
        bookedQuantity: item.quantity,
      })),
    [order.order_items, services]
  );

  // A weighed line the counter has not typed into is still "as booked"; a
  // typed one that does not parse is NaN, so it is caught rather than ignored.
  const quantities = useMemo(() => {
    const next: Record<string, number> = { ...pieces };
    for (const [itemId, text] of Object.entries(kgTexts)) {
      if (text.trim()) next[itemId] = parseWeight(text) ?? Number.NaN;
    }
    return next;
  }, [pieces, kgTexts]);

  const firstError = lines
    .map((line) => quantityError(line, quantityFor(line, quantities)))
    .find((message): message is string => message !== null);
  const isEmpty = lines.every((line) => line.unit !== 'per_kg' && quantityFor(line, quantities) === 0);
  const total = firstError ? null : checkTotal(lines, quantities);
  const difference = total === null ? null : describeWeighChange(order.estimated_total, total);

  const isPhotoRequired = order.order_type === 'online';
  const isMissingPhoto = isPhotoRequired && !photoUri;

  const mutation = useMutation({
    mutationFn: () =>
      confirmOrderPrice(order.id, {
        lines: lines.map((line) => ({ itemId: line.itemId, quantity: quantityFor(line, quantities) })),
        photoUri,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      setPieces({});
      setKgTexts({});
      setPhotoUri(null);
      onConfirmed();
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-price', err.message)),
  });

  const takePhoto = async () => {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const shot = permission.granted
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
      : // Not a dead end: offer the library to an owner who denied the camera once.
        await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!shot.canceled) setPhotoUri(shot.assets[0].uri);
  };

  return (
    <View style={styles.sheet}>
      <Text style={styles.heading}>Check the load</Text>
      <Subtle>Weigh what is sold by the kilo, count what is sold by the piece. Set 0 for anything not in the bag.</Subtle>

      <View style={styles.lines}>
        {lines.map((line) => (
          <LineRow
            key={line.itemId}
            line={line}
            quantities={quantities}
            kgText={kgTexts[line.itemId] ?? ''}
            onPieces={(next) => setPieces((prev) => ({ ...prev, [line.itemId]: next }))}
            onKg={(text) => setKgTexts((prev) => ({ ...prev, [line.itemId]: text }))}
          />
        ))}
      </View>

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
              {isPhotoRequired ? 'Photo of the load (and the scale)' : 'Add a photo (optional)'}
            </Text>
          </View>
        )}
      </Pressable>

      {total !== null ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Actual total</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      ) : null}
      {difference ? <Text style={styles.difference}>{difference}</Text> : null}
      {firstError ? <Subtle>{firstError}</Subtle> : null}
      {isEmpty ? <Subtle>At least one item has to stay on the order.</Subtle> : null}
      {isMissingPhoto ? <Subtle>Add a photo — it is what the customer sees beside the new price.</Subtle> : null}

      <ErrorText>{error}</ErrorText>
      <Button
        title={mutation.isPending ? 'Sending…' : 'Send actual price to customer'}
        disabled={Boolean(firstError) || isEmpty || isMissingPhoto || mutation.isPending}
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

  lines: { gap: space.tight },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.snug,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineText: { flex: 1, gap: 2 },
  lineName: { ...type.label, color: colors.text },
  removed: { color: colors.subtle, textDecorationLine: 'line-through' },
  lineMeta: { ...type.caption, color: colors.subtle, fontVariant: ['tabular-nums'] },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
  },
  countKey: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  countValue: { ...type.label, minWidth: 24, textAlign: 'center', color: colors.text, fontVariant: ['tabular-nums'] },

  kgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space.snug,
  },
  kgInput: { ...type.label, width: 56, height: 38, textAlign: 'right', color: colors.text },
  kgUnit: { ...type.caption, color: colors.subtle },

  photoBox: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.tight },
  photoLabel: { ...type.label, color: colors.actionInk },

  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.snug },
  totalLabel: { ...type.label, color: colors.subtle },
  totalValue: { ...type.title, color: colors.text },
  /** The sentence that will reach the customer. */
  difference: { ...type.body, fontWeight: '600', color: colors.actionInk },
});
