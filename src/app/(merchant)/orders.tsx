import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { ChipRow } from '@/components/chip-row';
import { OrderCard } from '@/components/order-card';
import { SearchField } from '@/components/search-field';
import { EmptyState, ErrorState, Loading, Screen, colors, space, type } from '@/components/ui-kit';
import { getShopOrders } from '@/lib/api';
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

  const chooseView = (next: BoardView) => {
    rememberedView = next;
    setView(next);
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.cosy, paddingBottom: space.tight },
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
