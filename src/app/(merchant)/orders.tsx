import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DoorSign } from '@/components/door-sign';
import { HeaderButton, SettingsButton } from '@/components/header-button';
import { PaymentsLedger } from '@/components/payments-ledger';
import { QueueRow } from '@/components/queue-row';
import { QueueTiles } from '@/components/queue-tiles';
import { SearchField } from '@/components/search-field';
import { Segmented } from '@/components/segmented';
import {
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  RADII,
  Screen,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { getShopOrders, updateOrderStatus, type OrderWithDetails } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { claimsToCheck } from '@/lib/domain/payment-ledger';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { BOARD_VIEWS, boardCounts, boardOrders, groupByDay, type BoardView } from '@/lib/domain/order-board';
import {
  STUCK_AFTER_DAYS,
  handOverPrompt,
  queueSections,
  queueStats,
  rowAction,
  stuckAction,
  type RowAction,
} from '@/lib/domain/order-queue';
import type { OrderStatus } from '@/lib/domain/order-status';
import { useActiveShop } from '@/lib/use-active-shop';
import { useHaptic } from '@/lib/use-app-settings';

/**
 * The view survives a trip to another tab. An owner working through Ready
 * all afternoon was bounced back to everything every time they checked Prices.
 */
let rememberedView: BoardView = 'active';

type Pane = 'orders' | 'payments';
let rememberedPane: Pane = 'orders';

/**
 * Views that are the live queue, sorted by urgency. The rest are history or a
 * money list, where the day an order came in is the useful heading.
 */
const QUEUE_VIEWS: readonly BoardView[] = ['active', 'overdue', 'working', 'ready', 'stuck'];

/** What an empty list means, and what the owner can do about it. */
function emptyCopy(view: BoardView, hasQuery: boolean): { message: string; actionLabel?: string } {
  if (hasQuery) return { message: 'No orders match that search.' };
  switch (view) {
    case 'active':
    case 'working':
      return {
        message: 'Nothing in the shop right now. New orders appear here the moment you save them.',
        actionLabel: 'Take a walk-in order',
      };
    case 'overdue':
      return { message: 'Nothing is overdue. Every load is on time.' };
    case 'ready':
      return { message: 'Nothing is waiting for pickup.' };
    case 'stuck':
      return { message: 'Nothing is stuck. Every order has moved this week.' };
    case 'collect':
      return { message: 'Nothing left to collect.' };
    case 'done':
      return { message: 'No finished orders yet.' };
    case 'all':
      return { message: 'No orders yet.', actionLabel: 'Take a walk-in order' };
  }
}

/** A quiet line of blue text that goes somewhere: the list's way out to another view. */
function LinkRow({
  label,
  onPress,
  isBack = false,
}: {
  label: string;
  onPress: () => void;
  isBack?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      {isBack ? <Ionicons name="chevron-back" size={16} color={colors.actionInk} /> : null}
      <Text style={styles.linkText}>{label}</Text>
      {isBack ? null : <Ionicons name="chevron-forward" size={16} color={colors.actionInk} />}
    </Pressable>
  );
}

/**
 * Stuck orders fold into one card at the foot of the queue. They are real —
 * someone has to ring the customer or cancel — but they are not today's work,
 * and listed one by one they turned the whole queue red.
 */
function StuckCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} stuck orders, no change in ${STUCK_AFTER_DAYS} days or more. Review`}
      onPress={onPress}
      style={({ pressed }) => [styles.stuck, pressed && styles.pressed]}
    >
      <Ionicons name="hourglass-outline" size={20} color={colors.subtle} />
      <View style={styles.stuckBody}>
        <Text style={styles.stuckTitle}>
          {count} stuck {count === 1 ? 'order' : 'orders'}
        </Text>
        <Text style={styles.stuckDetail}>No change in {STUCK_AFTER_DAYS}+ days</Text>
      </View>
      <Text style={styles.linkText}>Review</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.actionInk} />
    </Pressable>
  );
}

/**
 * Moves an order one step along from the list, updating the list before the
 * server answers so the row slides into its next section under the owner's
 * thumb. A refusal puts it back and says why.
 */
function useAdvanceOrder(shopId: string | undefined, onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const queryKey = ['shop-orders', shopId];

  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: OrderStatus }) => updateOrderStatus(id, to),
    onMutate: async ({ id, to }) => {
      haptic('commit');
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<OrderWithDetails[]>(queryKey);
      const touched = new Date().toISOString();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      queryClient.setQueryData<OrderWithDetails[]>(queryKey, (orders) =>
        orders?.map((order) =>
          order.id === id ? { ...order, status: to, updated_at: touched } : order
        )
      );
      return { previous };
    },
    onError: (error, _step, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      haptic('error');
      onError(friendlyMerchantError('move-order', error instanceof Error ? error.message : ''));
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['order-history', id] });
    },
  });
}

export default function MerchantOrders() {
  const router = useRouter();
  const navigation = useNavigation();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [pane, setPane] = useState<Pane>(rememberedPane);
  const [isSearching, setIsSearching] = useState(false);
  const [view, setView] = useState<BoardView>(rememberedView);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState('');
  // Captured once per render so every row dates itself against the same clock.
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

  const advance = useAdvanceOrder(shop?.id, setActionError);

  // Search is a sometimes-tool, so it lives in the header as an icon and only
  // takes a row of the screen while it is being used.
  useLayoutEffect(() => {
    const toggleSearch = () => {
      if (isSearching) setQuery('');
      setIsSearching(!isSearching);
    };
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          {pane === 'orders' ? (
            <HeaderButton
              icon={isSearching ? 'close' : 'search'}
              label={isSearching ? 'Close search' : 'Search orders'}
              onPress={toggleSearch}
            />
          ) : null}
          <HeaderButton
            icon="qr-code-outline"
            label="Scan a bag tag"
            onPress={() => router.push('/(merchant)/scan' as never)}
          />
          <SettingsButton />
        </View>
      ),
    });
  }, [navigation, isSearching, pane, router]);

  const all = useMemo(() => orders ?? [], [orders]);
  const isQueue = QUEUE_VIEWS.includes(view);
  // `now` is a fresh Date each render; these only need to follow the data.
  /* eslint-disable react-hooks/exhaustive-deps */
  const stats = useMemo(() => queueStats(all, now), [all]);
  const counts = useMemo(() => boardCounts(all, now), [all]);
  const sections = useMemo(() => {
    const shown = boardOrders(all, { view, query }, now);
    if (!isQueue) return groupByDay(shown, now);
    return queueSections(shown, now, { stuck: view === 'stuck' });
  }, [all, view, query, isQueue]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const toCheck = useMemo(() => claimsToCheck(all), [all]);

  const chooseView = (next: BoardView) => {
    rememberedView = next;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setView(next);
  };

  const choosePane = (next: Pane) => {
    rememberedPane = next;
    setPane(next);
  };

  // Sales links straight to a view ("Ready & unpaid" opens Collect). The tab
  // stays mounted, so the param is cleared once applied; otherwise a second
  // tap on the same link would change nothing.
  const { view: linkedView } = useLocalSearchParams<{ view?: string }>();
  const [handledLink, setHandledLink] = useState<string | undefined>(undefined);
  if (linkedView !== handledLink) {
    setHandledLink(linkedView);
    if (linkedView && BOARD_VIEWS.includes(linkedView as BoardView)) {
      setPane('orders');
      setView(linkedView as BoardView);
    }
  }
  useEffect(() => {
    if (!linkedView) return;
    if (BOARD_VIEWS.includes(linkedView as BoardView)) {
      rememberedPane = 'orders';
      rememberedView = linkedView as BoardView;
    }
    router.setParams({ view: undefined });
  }, [linkedView, router]);

  const openOrder = (id: string) => router.push(`/(merchant)/order/${id}`);

  const runAction = (order: OrderWithDetails, action: RowAction) => {
    setActionError('');
    if (action.kind === 'collect') {
      openOrder(order.id);
      return;
    }
    if (action.kind === 'call') {
      Linking.openURL(`tel:${action.phone}`).catch(() =>
        setActionError(`Could not start a call. The number is ${action.phone}.`)
      );
      return;
    }
    const step = () => advance.mutate({ id: order.id, to: action.to });
    if (action.to === 'completed') {
      confirmAction(handOverPrompt(order), step, { isDestructive: false });
      return;
    }
    step();
  };

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  // Payments is a different job — sitting down with the GCash app and working
  // through receipts — so it takes the whole screen below the switch rather
  // than a section the counter has to read past on every visit.
  const paneSwitch = (
    <Segmented
      options={[
        { key: 'orders', label: 'Orders' },
        { key: 'payments', label: toCheck > 0 ? `Payments · ${toCheck}` : 'Payments' },
      ]}
      value={pane}
      onChange={choosePane}
    />
  );

  if (pane === 'payments') {
    return (
      <Screen scroll={false}>
        <View style={styles.header}>
          {paneSwitch}
          <Text style={styles.detail}>
            {toCheck > 0
              ? `${toCheck} ${toCheck === 1 ? 'receipt' : 'receipts'} to check against your own account`
              : 'Nothing waiting on you'}
          </Text>
        </View>
        <PaymentsLedger shopId={shop.id} orders={all} onOpenOrder={openOrder} />
      </Screen>
    );
  }

  const empty = emptyCopy(view, query.trim().length > 0);
  const busyId = advance.isPending ? advance.variables?.id : undefined;
  // Headings only where they add something: the full queue's urgency bands and
  // the days of history. A single tile's list would just repeat the tile.
  const showsHeadings = view === 'active' || !isQueue;
  const isHistory = view === 'done' || view === 'all';

  const footer =
    view === 'active' ? (
      <View style={styles.footer}>
        {stats.stuck > 0 ? <StuckCard count={stats.stuck} onPress={() => chooseView('stuck')} /> : null}
        <LinkRow label={`Finished orders · ${counts.done}`} onPress={() => chooseView('done')} />
      </View>
    ) : view === 'collect' ? (
      <LinkRow label="Check receipts in Payments" onPress={() => choosePane('payments')} />
    ) : null;

  return (
    <Screen scroll={false}>
      {/* Pinned above the list, not inside it: the tiles are the state of the
          screen, and state should not scroll away. */}
      <View style={styles.header}>
        {/* The sign on the door first: whether customers can order at all is
            the state every other number on this screen depends on. */}
        {shop ? <DoorSign shop={shop} /> : null}
        {paneSwitch}
        <QueueTiles stats={stats} view={view} onChange={chooseView} />
        {isSearching ? (
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Name, number or ticket"
            accessibilityLabel="Search orders"
            autoFocus
          />
        ) : null}
        {isHistory || view === 'stuck' ? (
          <LinkRow label="Back to the queue" isBack onPress={() => chooseView('active')} />
        ) : null}
        {view === 'stuck' ? (
          <Text style={styles.hint}>
            No change in {STUCK_AFTER_DAYS}+ days. Ring the customer, or open the order to cancel it.
          </Text>
        ) : null}
        {error ? (
          <ErrorState
            message={friendlyMerchantError('load-orders', error.message)}
            onRetry={() => refetch()}
          />
        ) : null}
        <ErrorText>{actionError}</ErrorText>
      </View>

      <SectionList
        style={styles.fill}
        sections={sections}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => (
          <QueueRow
            order={item}
            now={now}
            action={view === 'stuck' ? stuckAction(item) : rowAction(item)}
            isBusy={busyId === item.id}
            onOpen={() => openOrder(item.id)}
            onAction={(action) => runAction(item, action)}
          />
        )}
        renderSectionHeader={({ section }) =>
          showsHeadings ? (
            <Text style={[styles.heading, section.title === 'Overdue' && styles.headingOverdue]}>
              {section.title}
            </Text>
          ) : (
            <View style={styles.headingGap} />
          )
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={isRefetching}
        onRefresh={refetch}
        ListFooterComponent={sections.length > 0 ? footer : null}
        ListEmptyComponent={
          <View style={styles.header}>
            <EmptyState
              message={empty.message}
              actionLabel={empty.actionLabel}
              onAction={empty.actionLabel ? () => router.push('/(merchant)/pos') : undefined}
            />
            {footer}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  header: { gap: space.cosy, paddingBottom: space.tight },
  pressed: { opacity: 0.7 },
  detail: { ...type.body, color: colors.subtle, marginTop: 2 },
  hint: { ...type.caption, color: colors.subtle },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: space.snug,
  },
  linkText: { ...type.label, color: colors.actionInk },
  footer: { gap: space.snug, paddingTop: space.section },
  stuck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  stuckBody: { flex: 1, minWidth: 0 },
  stuckTitle: { ...type.label, color: colors.text },
  stuckDetail: { ...type.caption, color: colors.subtle },
  fill: { flex: 1 },
  list: { paddingBottom: space.gulf },
  heading: {
    ...type.caption,
    fontFamily: type.label.fontFamily,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.subtle,
    paddingTop: space.room,
    paddingBottom: space.snug,
  },
  headingOverdue: { color: colors.dangerInk },
  headingGap: { height: space.snug },
  gap: { height: 6 },
});
