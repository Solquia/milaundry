import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MerchantAddons } from '@/components/merchant-addons';
import { PriceBoard } from '@/components/price-board';
import { Segmented } from '@/components/segmented';
import { ServiceForm, type ServiceFormOutcome } from '@/components/service-form';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  TAG_TONES,
  colors,
  space,
  type,
  RADII,
  fontFor,
} from '@/components/ui-kit';
import { getServices, seedStarterServices } from '@/lib/api';
import { canManageShop } from '@/lib/domain/merchant-access';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { savedNotice, unpricedNotice } from '@/lib/domain/price-sections';
import { STARTER_SERVICES } from '@/lib/domain/service-catalog';
import type { ServiceRow as ServiceRecord } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';

type PricesMode = 'services' | 'addons';

/**
 * Services or add-ons: the two price lists an owner keeps. Pinned above the
 * scroll, because a detergent typed in as a ₱0 "service" showed the owner had
 * never seen the switch — it scrolled away with the list it switches.
 */
const MODE_OPTIONS: { key: PricesMode; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'addons', label: 'Add-ons' },
];

type PricesView = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; service: ServiceRecord };

function Notice({ tone, children }: { tone: keyof typeof TAG_TONES; children: string }) {
  return (
    <View
      style={[styles.notice, { backgroundColor: TAG_TONES[tone].bg }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.noticeText, { color: TAG_TONES[tone].ink }]}>{children}</Text>
    </View>
  );
}

/** Small, beside the switch: adding is always one tap away without a slab of blue. */
function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a service"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
    >
      <Ionicons name="add" size={18} color={colors.onAccent} />
      <Text style={styles.addText}>Add</Text>
    </Pressable>
  );
}

function StarterCard({ shopId, onSeeded }: { shopId: string; onSeeded: () => void }) {
  const [seedError, setSeedError] = useState('');
  const seedMutation = useMutation({
    mutationFn: () => seedStarterServices(shopId, STARTER_SERVICES),
    onSuccess: onSeeded,
    onError: (err: Error) => setSeedError(friendlyMerchantError('save-price', err.message)),
  });

  return (
    <Card>
      <Text style={type.section}>Start your price list</Text>
      <Subtle>
        We can fill this in with the usual laundry shop prices — wash and fold by the kilo,
        ironing and dry cleaning by the piece, comforters, curtains and self-service loads.
        Change any price afterwards to match your shop.
      </Subtle>
      <ErrorText>{seedError}</ErrorText>
      <Button
        title={seedMutation.isPending ? 'Adding prices…' : 'Use the usual prices'}
        onPress={() => seedMutation.mutate()}
        disabled={seedMutation.isPending}
      />
    </Card>
  );
}

export default function MerchantServices() {
  const queryClient = useQueryClient();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  const [mode, setMode] = useState<PricesMode>('services');
  const [view, setView] = useState<PricesView>({ kind: 'list' });
  const [outcome, setOutcome] = useState<ServiceFormOutcome | null>(null);

  // `error` was previously never destructured, so a failed fetch rendered as
  // an empty list under the "Start your price list" card — a network problem
  // shown to the owner as though their shop had no prices.
  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ['services', shop?.id],
    queryFn: () => getServices(shop!.id),
    enabled: Boolean(shop),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services', shop?.id] });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState
          message={friendlyMerchantError('load-prices', error.message)}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  // Staff keep the price list (adding and changing prices); the Add-ons shelf
  // and its switch are the owner's.
  const isOwner = canManageShop(shopRole);
  const openForm = (next: PricesView) => {
    setOutcome(null);
    setView(next);
  };

  if (view.kind !== 'list') {
    const goToAddons = () => {
      setView({ kind: 'list' });
      setMode('addons');
    };
    return (
      // Keyed by view so the form opens at its top, and the list returns to its own.
      <Screen key={view.kind === 'edit' ? `edit-${view.service.id}` : view.kind}>
        <ServiceForm
          shopId={shop.id}
          service={view.kind === 'edit' ? view.service : undefined}
          onCancel={() => setView({ kind: 'list' })}
          onDone={(done) => {
            setOutcome(done);
            setView({ kind: 'list' });
            refresh();
          }}
          onGoToAddons={isOwner ? goToAddons : undefined}
        />
      </Screen>
    );
  }

  const isAddons = isOwner && mode === 'addons';
  const header = (
    <View style={styles.headerRow}>
      {isOwner ? (
        <View style={styles.switch}>
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </View>
      ) : (
        <Text style={styles.headerTitle}>Services</Text>
      )}
      {isAddons ? null : <AddButton onPress={() => openForm({ kind: 'add' })} />}
    </View>
  );

  if (isAddons) {
    return (
      <Screen key="addons" header={header}>
        <MerchantAddons shopId={shop.id} />
      </Screen>
    );
  }

  const list = services ?? [];
  const unpriced = unpricedNotice(list);
  const highlightName = outcome && outcome.verb !== 'removed' ? outcome.name : null;

  return (
    <Screen key="list" header={header}>
      {outcome ? <Notice tone="settled">{savedNotice(outcome)}</Notice> : null}
      {unpriced ? <Notice tone="owed">{unpriced}</Notice> : null}
      {list.length === 0 && <StarterCard shopId={shop.id} onSeeded={refresh} />}

      {list.length > 0 ? (
        <PriceBoard
          services={list}
          highlightName={highlightName}
          onOpen={(service) => openForm({ kind: 'edit', service })}
          onAdd={() => openForm({ kind: 'add' })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  switch: { flex: 1 },
  headerTitle: { ...type.label, fontFamily: fontFor(600), color: colors.text, flex: 1 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 40,
    paddingLeft: space.snug,
    paddingRight: space.cosy,
    borderRadius: 999,
    backgroundColor: colors.action,
  },
  addPressed: { opacity: 0.85 },
  addText: { ...type.label, fontFamily: fontFor(600), color: colors.onAccent },

  notice: { paddingHorizontal: space.cosy, paddingVertical: space.snug, borderRadius: RADII.control },
  noticeText: { ...type.caption },
});
