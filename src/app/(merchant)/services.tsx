import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MerchantAddons } from '@/components/merchant-addons';
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
  CROWN,
  RADII,
  fontFor,
} from '@/components/ui-kit';
import { getServices, seedStarterServices } from '@/lib/api';
import { canManageShop } from '@/lib/domain/merchant-access';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { priceSubtitle } from '@/lib/domain/price-label';
import { categoryPriceSummary, savedNotice, unpricedNotice } from '@/lib/domain/price-sections';
import {
  CATEGORY_LABELS,
  STARTER_SERVICES,
  groupServicesByCategory,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { categoryIcon } from '@/lib/domain/shop-home';
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

/**
 * One price: the whole row opens it. The unit rides with the figure, because
 * "₱176" on its own does not say whether that is a kilo or a whole load.
 */
function PriceRow({
  service,
  isFirst,
  isHighlighted,
  onOpen,
}: {
  service: ServiceRecord;
  isFirst: boolean;
  isHighlighted: boolean;
  onOpen: () => void;
}) {
  const isUnpriced = !(service.price > 0);
  const priceText = isUnpriced ? 'no price set' : priceSubtitle(service);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${priceText}`}
      accessibilityHint="Opens it to change any detail"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivided,
        isHighlighted && styles.rowHighlighted,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{service.name}</Text>
        {isUnpriced ? null : <Text style={styles.rowPrice}>{priceText}</Text>}
        {service.description ? <Subtle>{service.description}</Subtle> : null}
      </View>
      {isUnpriced ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>Set price</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

/**
 * One category, always open. The list used to be an accordion that opened one
 * section at a time, so most categories showed a count and a range instead of
 * their one price, and two categories could never be compared side by side.
 */
function PriceSection({
  group,
  highlightName,
  onOpen,
}: {
  group: ServiceGroup<ServiceRecord>;
  highlightName: string | null;
  onOpen: (service: ServiceRecord) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons
          name={categoryIcon(group.category) as never}
          size={18}
          color={colors.actionInk}
        />
        <Text style={styles.sectionName}>{CATEGORY_LABELS[group.category]}</Text>
        <Text style={styles.sectionSummary}>{categoryPriceSummary(group.services)}</Text>
      </View>
      <View style={styles.sheet}>
        {group.services.map((service, index) => (
          <PriceRow
            key={service.id}
            service={service}
            isFirst={index === 0}
            isHighlighted={service.name === highlightName}
            onOpen={() => onOpen(service)}
          />
        ))}
      </View>
    </View>
  );
}

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

  const modeSwitch = isOwner ? (
    <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
  ) : undefined;

  if (isOwner && mode === 'addons') {
    return (
      <Screen key="addons" header={modeSwitch}>
        <MerchantAddons shopId={shop.id} />
      </Screen>
    );
  }

  const list = services ?? [];
  const groups = groupServicesByCategory(list);
  const unpriced = unpricedNotice(list);
  const highlightName = outcome && outcome.verb !== 'removed' ? outcome.name : null;

  return (
    <Screen
      key="list"
      header={modeSwitch}
      footer={<Button title="Add a service" onPress={() => openForm({ kind: 'add' })} />}
    >
      {outcome ? <Notice tone="settled">{savedNotice(outcome)}</Notice> : null}
      {unpriced ? <Notice tone="owed">{unpriced}</Notice> : null}
      {list.length === 0 && <StarterCard shopId={shop.id} onSeeded={refresh} />}

      {groups.map((group) => (
        <PriceSection
          key={group.category}
          group={group}
          highlightName={highlightName}
          onOpen={(service) => openForm({ kind: 'edit', service })}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.snug },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.tight,
  },
  sectionName: { ...type.label, fontFamily: fontFor(600), color: colors.text, flex: 1 },
  sectionSummary: { ...type.caption, color: colors.subtle },

  /** A category's prices: one sheet, ruled inside, like a printed price board. */
  sheet: {
    backgroundColor: colors.card,
    ...CROWN,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    minHeight: 56,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowHighlighted: { backgroundColor: TAG_TONES.settled.bg },
  pressed: { backgroundColor: colors.sunken },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { ...type.body, fontFamily: fontFor(600), color: colors.text },
  rowPrice: { ...type.caption, color: colors.subtle },

  flag: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.control,
    backgroundColor: TAG_TONES.owed.bg,
  },
  flagText: { ...type.caption, fontFamily: fontFor(600), color: TAG_TONES.owed.ink },

  notice: { padding: space.cosy, borderRadius: RADII.control },
  noticeText: { ...type.label, fontFamily: fontFor(400) },
});
