import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
} from '@/components/ui-kit';
import { getServices, seedStarterServices, updateService, upsertService } from '@/lib/api';
import type { PricingUnit } from '@/lib/domain/pricing';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STARTER_SERVICES,
  groupServicesByCategory,
  type ServiceCategory,
} from '@/lib/domain/service-catalog';
import type { ServiceRow } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';

const UNIT_OPTIONS: { value: PricingUnit; label: string }[] = [
  { value: 'per_kg', label: 'Per kg' },
  { value: 'per_item', label: 'Per piece' },
  { value: 'flat', label: 'Flat rate' },
];

const unitSuffix = (unit: PricingUnit) =>
  unit === 'per_kg' ? '/kg' : unit === 'per_item' ? '/piece' : ' flat';

function CategoryChips({
  value,
  onChange,
}: {
  value: ServiceCategory;
  onChange: (category: ServiceCategory) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {CATEGORY_ORDER.map((category) => (
        <Pressable
          key={category}
          accessibilityRole="button"
          accessibilityState={{ selected: value === category }}
          onPress={() => onChange(category)}
          style={{
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: value === category ? colors.primary : colors.card,
            borderWidth: 1,
            borderColor: value === category ? colors.primary : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: value === category ? '#FFFFFF' : colors.subtle,
            }}
          >
            {CATEGORY_LABELS[category]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ServiceCard({
  service,
  onSaved,
}: {
  service: ServiceRow;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(String(service.price));
  const [minQuantity, setMinQuantity] = useState(String(service.min_quantity));
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateService>[1]) =>
      updateService(service.id, patch),
    onSuccess: () => {
      setIsEditing(false);
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSave = () => {
    const parsedPrice = Number(price);
    const parsedMin = Number(minQuantity);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      setError('Enter a valid minimum.');
      return;
    }
    mutation.mutate({ price: parsedPrice, min_quantity: parsedMin });
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', flex: 1 }}>{service.name}</Text>
        <Text
          style={{ color: colors.primary, fontWeight: '600' }}
          onPress={() => setIsEditing((editing) => !editing)}
        >
          {isEditing ? 'Close' : 'Edit'}
        </Text>
      </View>
      <Subtle>
        {formatMoney(service.price)}
        {unitSuffix(service.unit)}
        {service.min_quantity > 0 ? ` · min ${service.min_quantity} kg` : ''}
      </Subtle>
      {service.description ? <Subtle>{service.description}</Subtle> : null}

      {isEditing && (
        <>
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          {service.unit === 'per_kg' && (
            <Field
              label="Minimum kg (0 = none)"
              value={minQuantity}
              onChangeText={setMinQuantity}
              keyboardType="decimal-pad"
            />
          )}
          <ErrorText>{error}</ErrorText>
          <Button
            title={mutation.isPending ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={mutation.isPending}
          />
          <Button
            title="Remove from price list"
            variant="danger"
            onPress={() => mutation.mutate({ is_active: false })}
          />
        </>
      )}
    </Card>
  );
}

function AddServiceForm({ shopId, onSaved }: { shopId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<PricingUnit>('per_kg');
  const [category, setCategory] = useState<ServiceCategory>('wash_fold');
  const [minQuantity, setMinQuantity] = useState('0');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      upsertService({
        shop_id: shopId,
        name: name.trim(),
        unit,
        price: Number(price),
        category,
        min_quantity: unit === 'per_kg' ? Number(minQuantity) || 0 : 0,
        description: description.trim(),
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setDescription('');
      setMinQuantity('0');
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleAdd = () => {
    const parsedPrice = Number(price);
    if (!name.trim()) {
      setError('Enter a service name.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid price.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Card>
      <Text style={{ fontWeight: '600', fontSize: 16 }}>Add a service</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Wash, Dry & Fold" />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtle }}>Category</Text>
      <CategoryChips value={category} onChange={setCategory} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtle }}>
        How is it priced?
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {UNIT_OPTIONS.map((option) => (
          <View key={option.value} style={{ flex: 1 }}>
            <Button
              title={option.label}
              variant={unit === option.value ? 'primary' : 'outline'}
              onPress={() => setUnit(option.value)}
            />
          </View>
        ))}
      </View>
      <Field
        label={
          unit === 'per_kg'
            ? 'Price per kg'
            : unit === 'per_item'
              ? 'Price per piece'
              : 'Flat price'
        }
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="35.00"
      />
      {unit === 'per_kg' && (
        <Field
          label="Minimum kg (0 = none)"
          value={minQuantity}
          onChangeText={setMinQuantity}
          keyboardType="decimal-pad"
          placeholder="5"
        />
      )}
      <Field
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Regular clothes, 5 kg minimum"
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title={mutation.isPending ? 'Saving…' : 'Add service'}
        onPress={handleAdd}
        disabled={mutation.isPending}
      />
    </Card>
  );
}

export default function MerchantServices() {
  const queryClient = useQueryClient();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [seedError, setSeedError] = useState('');

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', shop?.id],
    queryFn: () => getServices(shop!.id),
    enabled: Boolean(shop),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services', shop?.id] });

  const seedMutation = useMutation({
    mutationFn: () => seedStarterServices(shop!.id, STARTER_SERVICES),
    onSuccess: refresh,
    onError: (err: Error) => setSeedError(err.message),
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  const groups = groupServicesByCategory(services ?? []);

  return (
    <Screen>
      {services?.length === 0 && (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>Start your price list</Text>
          <Subtle>
            Load a ready-made laundromat price list (wash & fold per kilo with minimum weight,
            ironing and dry cleaning per piece, comforters and curtains, self-service loads) —
            then edit prices to match your shop.
          </Subtle>
          <ErrorText>{seedError}</ErrorText>
          <Button
            title={seedMutation.isPending ? 'Loading…' : 'Load starter price list'}
            onPress={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          />
        </Card>
      )}

      {groups.map((group) => (
        <View key={group.category} style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>
            {CATEGORY_LABELS[group.category]}
          </Text>
          {group.services.map((service) => (
            <ServiceCard key={service.id} service={service} onSaved={refresh} />
          ))}
        </View>
      ))}

      <AddServiceForm shopId={shop.id} onSaved={refresh} />
    </Screen>
  );
}
