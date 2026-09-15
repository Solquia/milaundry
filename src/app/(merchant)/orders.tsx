import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ChipRow } from '@/components/chip-row';
import { OrderCard } from '@/components/order-card';
import { PaymentsLedger } from '@/components/payments-ledger';
import { SearchField } from '@/components/search-field';
import {
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  colors,
  elevation,
  space,
  type,
} from '@/components/ui-kit';
import { getShopOrders } from '@/lib/api';
import { claimsToCheck } from '@/lib/domain/payment-ledger';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  BOARD_VIEWS,
  SOURCE_OPTIONS,
  boardCounts,
  boardHeadline,
  boardOrders,
  groupByDay,
  type BoardView,
  type SourceKey,
} from '@/lib/domain/order-board';
import { useActiveShop } from '@/lib/use-active-shop';

/**
 * The view survives a trip to another tab. An owner working through Unpaid
 * all afternoon was bounced back to Active every time they checked Prices.
 */
let rememberedView: BoardView = 'active';

/** Which half of this tab the shop was last in. Survives the same trip. */
type Mode = 'orders' | 'payments';
let rememberedMode: Mode = 'orders';

/**
 * Orders and Payments are two jobs, not two filters.
 *
 * The chip rows below choose *which orders*; this chooses what the screen is
 * for — running the shop, or sitting down with the GCash app and working
 * through receipts. A third chip row would have buried that distinction in a
 * line of things that all look like filters, so the switch is its own control
 * above the heading, two halves, always both visible.
 */
function ModeSwitch({
  mode,
  onChange,
  toCheck,
}: {
  mode: Mode;
  onChange: (next: Mode) => void;
  /** Receipts waiting on the shop, shown on the Payments half when non-zero. */
  toCheck: number;
}) {
  const options: { key: Mode; label: string }[] = [
    { key: 'orders', label: 'Orders' },
    { key: 'payments', label: toCheck > 0 ? `Payments · ${toCheck}` : 'Payments' },
  ];
  return (
    <View style={styles.modeSwitch} accessibilityRole="tablist">
      {options.map((option) => {
        const isSelected = option.key === mode;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.key)}
            style={[styles.mode, isSelected && styles.modeOn]}
          >
            <Text style={[styles.modeText, isSelected && styles.modeTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What an empty list means, and what the owner can do about it. */
function emptyCopy(view: BoardView, hasQuery: boolean): { message: string; actionLabel?: string } {
  if (hasQuery) return { message: 'No orders match that search.' };
  switch (view) {
    case 'active':
      return {
        message: 'Nothing in the shop right now. New orders appear here the moment you save them.',
        actionLabel: 'Take a walk-in order',
      };
    case 'ready':
      return { message: 'Nothing is waiting for pickup.' };
    case 'unpaid':
      return { message: 'Everyone has paid. Nothing left to collect.' };
    case 'done':
      return { message: 'No finished orders yet.' };
    case 'all':
      return { message: 'No orders yet.', actionLabel: 'Take a walk-in order' };
  }
}

export default function MerchantOrders() {
  const router = useRouter();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [mode, setMode] = useState<Mode>(rememberedMode);
  const [view, setView] = useState<BoardView>(rememberedView);
  const [source, setSource] = useState<SourceKey>('all');
  const [query, setQuery] = useState('');
  // Captured once per render so every card dates itself against the same clock.
  const now = new Date();

  const {
    data: orders,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 15_000,
  });

  const all = useMemo(() => orders ?? [], [orders]);
  const headline = useMemo(() => boardHeadline(all), [all]);
  const counts = useMemo(() => boardCounts(all), [all]);
  const sections = useMemo(
    () => groupByDay(boardOrders(all, { view, source, query }), now),
    // `now` is a fresh Date each render; the sections only need to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, view, source, query]
  );

  const toCheck = useMemo(() => claimsToCheck(all), [all]);

  const chooseView = (next: BoardView) => {
    rememberedView = next;
    setView(next);
  };
  const chooseMode = (next: Mode) => {
    rememberedMode = next;
    setMode(next);
  };

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  const empty = emptyCopy(view, query.trim().length > 0);
  const views = BOARD_VIEWS.map((option) => ({ ...option, count: counts[option.key] }));

  return (
    <Screen scroll={false}>
      {/* Pinned above the list, not inside it: the headline and the filters
          are the state of the screen, and state should not scroll away. */}
      <View style={styles.header}>
        <ModeSwitch mode={mode} onChange={chooseMode} toCheck={toCheck} />
        {mode === 'payments' ? (
          <View accessible accessibilityRole="header">
            <Text style={styles.title}>Payments</Text>
            <Text style={styles.detail}>
              {toCheck > 0
                ? `${toCheck} ${toCheck === 1 ? 'receipt' : 'receipts'} to check against your own account`
                : 'Nothing waiting on you'}
            </Text>
          </View>
        ) : null}
      </View>

      {mode === 'payments' ? (
        <PaymentsLedger
          shopId={shop.id}
          orders={all}
          onOpenOrder={(orderId) => router.push(`/(merchant)/order/${orderId}`)}
        />
      ) : null}

      {mode === 'orders' ? (
      <View style={styles.header}>
        <View accessible accessibilityRole="header">
          <Text style={styles.title}>{headline.title}</Text>
          <Text style={styles.detail}>{headline.detail}</Text>
        </View>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Name, number or ticket"
          accessibilityLabel="Search orders"
        />
        <ChipRow options={views} value={view} onChange={chooseView} label="Show orders" />
        <ChipRow
          options={SOURCE_OPTIONS}
          value={source}
          onChange={setSource}
          label="Filter by where the order came from"
          tone="ghost"
        />
        {error ? (
          <ErrorState
            message={friendlyMerchantError('load-orders', error.message)}
            onRetry={() => refetch()}
          />
        ) : null}
      </View>
      ) : null}

      {mode === 'orders' ? (
      <SectionList
        style={styles.fill}
        sections={sections}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            now={now}
            onPress={() => router.push(`/(merchant)/order/${item.id}`)}
          />
        )}
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            message={empty.message}
            actionLabel={empty.actionLabel}
            onAction={empty.actionLabel ? () => router.push('/(merchant)/pos') : undefined}
          />
        }
      />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.cosy, paddingBottom: space.tight },

  // A track with two halves, so both jobs are always legible and the selected
  // one is a raised surface rather than a colour the other half also wears.
  modeSwitch: {
    flexDirection: 'row',
    gap: space.tight,
    padding: space.tight,
    borderRadius: 999,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.snug,
    borderRadius: 999,
  },
  modeOn: { backgroundColor: colors.card, ...elevation.rest },
  modeText: { ...type.label, color: colors.subtle },
  modeTextOn: { color: colors.text },
  title: { ...type.title, color: colors.text },
  detail: { ...type.body, color: colors.subtle, marginTop: 2 },
  fill: { flex: 1 },
  list: { paddingBottom: space.gulf },
  day: {
    ...type.caption,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.subtle,
    paddingTop: space.room,
    paddingBottom: space.snug,
  },
  gap: { height: space.snug },
});
