import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PanelCard } from '@/components/admin-pulse';
import { PillButton, adminColors } from '@/components/admin-ui';
import { ServiceForm } from '@/components/service-form';
import { getServices, seedStarterServices } from '@/lib/api';
import { formatPriceLine } from '@/lib/domain/price-label';
import { savedNotice } from '@/lib/domain/price-sections';
import {
  CATEGORY_LABELS,
  STARTER_SERVICES,
  groupServicesByCategory,
} from '@/lib/domain/service-catalog';
import type { ServiceRow } from '@/lib/types';

type PriceView = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; service: ServiceRow };

/**
 * The shop's price list as the admin manages it. Adding and editing reuse the
 * merchant's own form, so both sides validate a price the same way and a fix
 * made for one is a fix for the other.
 */
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
  const [view, setView] = useState<PriceView>({ kind: 'list' });

  const { data: services } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services', shopId] });

  const seed = useMutation({
    mutationFn: () => seedStarterServices(shopId, STARTER_SERVICES),
    onSuccess: () => {
      onMessage('Usual laundry prices added. Change any of them to match the shop.');
      refresh();
    },
    onError,
  });

  if (view.kind !== 'list') {
    return (
      <PanelCard>
        <ServiceForm
          key={view.kind === 'edit' ? view.service.id : 'add'}
          shopId={shopId}
          service={view.kind === 'edit' ? view.service : undefined}
          onCancel={() => setView({ kind: 'list' })}
          onDone={(outcome) => {
            onMessage(savedNotice(outcome));
            setView({ kind: 'list' });
            refresh();
          }}
        />
      </PanelCard>
    );
  }

  const groups = groupServicesByCategory(services ?? []);

  return (
    <PanelCard
      title="Price list"
      hint="What customers see when they book. Tap a price to change it."
      action={
        <Pressable
          accessibilityRole="button"
          onPress={() => setView({ kind: 'add' })}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={18} color={adminColors.accentInk} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      }
    >
      {services?.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No prices yet. Start from the usual laundry prices, then adjust them.
          </Text>
          <PillButton
            title={seed.isPending ? 'Adding…' : 'Use the usual prices'}
            variant="outline"
            onPress={() => seed.mutate()}
            disabled={seed.isPending}
          />
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.category} style={styles.group}>
          <Text style={styles.groupLabel}>{CATEGORY_LABELS[group.category].toUpperCase()}</Text>
          <View style={styles.groupList}>
            {group.services.map((service, index) => (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${service.name}`}
                onPress={() => setView({ kind: 'edit', service })}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivider,
                  pressed && { backgroundColor: adminColors.paper },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {service.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {formatPriceLine(service)}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={18} color={adminColors.subtle} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: adminColors.accentSoft,
  },
  addButtonText: { fontSize: 14, fontWeight: '700', color: adminColors.accentInk },
  empty: { gap: 10 },
  emptyText: { fontSize: 14, color: adminColors.subtle },
  group: { gap: 6 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: adminColors.subtle },
  groupList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminColors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: adminColors.border },
  rowName: { fontSize: 15, fontWeight: '600', color: adminColors.text },
  rowMeta: { fontSize: 13, color: adminColors.subtle },
});
