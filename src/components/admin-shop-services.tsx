import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chip, PillButton, adminColors } from '@/components/admin-ui';
import { ErrorText, Field, Subtle } from '@/components/ui-kit';
import { getServices, seedStarterServices, upsertService } from '@/lib/api';
import { formatPriceLine } from '@/lib/domain/price-label';
import type { PricingUnit } from '@/lib/domain/pricing';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_SHORT,
  STARTER_SERVICES,
  type ServiceCategory,
} from '@/lib/domain/service-catalog';

const UNITS: { value: PricingUnit; label: string }[] = [
  { value: 'per_kg', label: 'Per kg' },
  { value: 'per_item', label: 'Per piece' },
  { value: 'flat', label: 'Flat' },
];

export function AdminShopServices({
  shopId,
  onError,
  onMessage,
}: {
  shopId: string;
  onError: (err: Error) => void;
  onMessage: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<PricingUnit>('per_kg');
  const [category, setCategory] = useState<ServiceCategory>('wash_fold');
  const [minQuantity, setMinQuantity] = useState('5');
  const [formError, setFormError] = useState('');

  const { data: services } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services', shopId] });

  const seed = useMutation({
    mutationFn: () => seedStarterServices(shopId, STARTER_SERVICES),
    onSuccess: () => {
      onMessage('Usual laundry prices added. You can change any of them.');
      refresh();
    },
    onError,
  });

  const add = useMutation({
    mutationFn: () =>
      upsertService({
        shop_id: shopId,
        name: name.trim(),
        unit,
        price: Number(price),
        category,
        min_quantity: unit === 'per_kg' ? Number(minQuantity) || 0 : 0,
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setFormError('');
      onMessage('Service added.');
      refresh();
    },
    onError,
  });

  const handleAdd = () => {
    if (!name.trim()) {
      setFormError('Enter a service name.');
      return;
    }
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFormError('Enter a valid price.');
      return;
    }
    setFormError('');
    add.mutate();
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Price list</Text>
        <Subtle>What customers see when they book this shop.</Subtle>
        {services?.length === 0 ? (
          <>
            <Subtle>No services yet. Add one below, or fill in the usual laundry prices.</Subtle>
            <PillButton
              title={seed.isPending ? 'Adding…' : 'Use the usual prices'}
              variant="outline"
              onPress={() => seed.mutate()}
              disabled={seed.isPending}
            />
          </>
        ) : (
          services?.map((service) => (
            <View key={service.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{service.name}</Text>
                <Subtle>
                  {CATEGORY_LABELS[service.category] ?? 'Other'} · {formatPriceLine(service)}
                </Subtle>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a service</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Wash, Dry & Fold" />
        <Subtle>Category</Subtle>
        <View style={styles.wrap}>
          {CATEGORY_ORDER.map((option) => (
            <Chip
              key={option}
              label={CATEGORY_SHORT[option]}
              isSelected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
        <View style={styles.wrap}>
          {UNITS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              isSelected={unit === option.value}
              onPress={() => setUnit(option.value)}
            />
          ))}
        </View>
        <Field
          label={unit === 'per_kg' ? 'Price per kg' : unit === 'per_item' ? 'Price per piece' : 'Flat price'}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="35"
        />
        {unit === 'per_kg' ? (
          <Field
            label="Smallest load, in kg"
            value={minQuantity}
            onChangeText={setMinQuantity}
            keyboardType="decimal-pad"
            placeholder="5"
          />
        ) : null}
        <ErrorText>{formError}</ErrorText>
        <PillButton
          title={add.isPending ? 'Adding…' : 'Add service'}
          onPress={handleAdd}
          disabled={add.isPending}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: adminColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: adminColors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: adminColors.border,
  },
  rowName: { fontWeight: '700', color: adminColors.text },
});
