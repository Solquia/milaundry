import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueField } from '@/components/blue-field';
import { GLASS_GROUND, PastelWash, glassPane } from '@/components/glass';
import { LaundryLine } from '@/components/laundry-line';
import { LiftPressable } from '@/components/lift-pressable';
import { QuickBookCard } from '@/components/quick-book';
import { ShopRail, type RailShop } from '@/components/shop-rail';
import {
  ACCENTS,
  BLUE_FIELD,
  Button,
  EmptyState,
  ErrorText,
  Loading,
  RADII,
  STATUS_COLORS,
  STATUS_LABELS,
  colors,
  elevation,
  formatMoney,
  mono,
  space,
  type,
} from '@/components/ui-kit';
import { getMyOrders, getRegisteredShops, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { canHideOrder, hideOrderPrompt } from '@/lib/domain/hidden-orders';
import { useHiddenOrders } from '@/lib/use-hidden-orders';
import { assignBrandAccents, resolveAccent } from '@/lib/domain/shop-branding';
import { useNow } from '@/lib/use-now';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { connectedShopTiles } from '@/lib/domain/connected-shops';
import {
  homeAttention,
  type AttentionCard,
} from '@/lib/domain/home-attention';
import { homeGreeting } from '@/lib/domain/home-greeting';
import { readAvailability, shopStatus } from '@/lib/domain/shop-availability';
import { quickBookTarget, recentShops } from '@/lib/domain/recent-shops';
import { homeSubline, type HeadlineOrder } from '@/lib/domain/home-headline';
import { formatOrderTime } from '@/lib/domain/order-card';
import { TERMINAL_STATUSES } from '@/lib/domain/order-status';
import {
  actionableCount,
  badgeLabel,
  bellLabel,
  buildNotifications,
  enabledNotifications,
} from '@/lib/domain/notifications';
import { useAppSettings, useHaptic } from '@/lib/use-app-settings';
import { fontFor } from '@/lib/domain/design-scale';

/** The pinned bar's own height, under the status bar. */
const TOP_BAR_HEIGHT = 52;
/**
 * How far the greeting sits below the bell and the gear.
 *
 * It used to start immediately under them, which put the biggest type on the
 * screen hard against two small controls and left the whole block reading as
 * something floating above the page rather than the top of it. Dropping it a
 * step pulls it away from the controls and toward the sheet it introduces —
 * the same gap the greeting already keeps from the card beneath it, so the
 * block is spaced evenly on both sides instead of hugging the chrome.
 */
const GREETING_DROP = 28;
/**
 * The white sheet's corner: generous while it sits below the greeting, tighter
 * once it has ridden up over it. A sheet at rest is an object on the field; a
 * sheet carrying the whole screen is the page, and pages have smaller corners.
 */
const SHEET_RADIUS_REST = 32;
const SHEET_RADIUS_RIDE = 20;
/** How far up the sheet has to come before it counts as riding. */
const RIDE_AT = 90;

/** The iOS disclosure chevron's grey. */
const CHEVRON = '#C7C7CC';

/** "TUESDAY, OCTOBER 14" — the line Apple sets over a Today page. */
function dateLine(now: Date): string {
  return now
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
}

/** The reader's initials for the account button, the way the App Store shows it. */
function initialsOf(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '•';
}

function toHeadlineOrder(order: OrderWithDetails): HeadlineOrder {
  return {
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    shopName: order.shop?.name ?? 'Laundry shop',
  };
}

/**
 * Whether the past orders are showing. Closed by default — finished and
 * cancelled orders are history, and listed in full they buried the page under
 * receipts nobody came here to read — but a customer who opened them keeps
 * them open across a trip to another tab.
 */
let rememberedPastOpen = false;

export default function CustomerOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const haptic = useHaptic();
  const { profile } = useAuth();
  const isReduced = useReducedMotion();
  const [isPastOpen, setIsPastOpen] = useState(rememberedPastOpen);
  const { hiddenIds, hide } = useHiddenOrders();

  const togglePast = () => {
    const next = !isPastOpen;
    rememberedPastOpen = next;
    haptic('select');
    if (!isReduced) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPastOpen(next);
  };

  /** One driver for the whole page: the finger. */
  const [scrollY] = useState(() => new Animated.Value(0));
  /**
   * The sheet's corner, which the native driver cannot carry. Rather than
   * interpolate a radius on every frame in JavaScript, it is animated once
   * when the sheet passes the greeting — one timing per crossing, not sixty a
   * second — and the listener below is the only JS the scroll touches.
   */
  const [sheetRadius] = useState(() => new Animated.Value(SHEET_RADIUS_REST));
  const isRiding = useRef(false);

  useEffect(() => {
    if (isReduced) return;
    const id = scrollY.addListener(({ value }) => {
      const riding = value > RIDE_AT;
      if (riding === isRiding.current) return;
      isRiding.current = riding;
      Animated.timing(sheetRadius, {
        toValue: riding ? SHEET_RADIUS_RIDE : SHEET_RADIUS_REST,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, sheetRadius, isReduced]);

  const greeting = homeGreeting(profile?.full_name);

  // Still page, still greeting: a device asking for less motion gets the
  // composition and none of the parallax.
  const greetLag = isReduced
    ? 0
    : scrollY.interpolate({ inputRange: [0, 240], outputRange: [0, 84], extrapolate: 'clamp' });
  const greetFade = isReduced
    ? 1
    : scrollY.interpolate({ inputRange: [0, 130], outputRange: [1, 0], extrapolate: 'clamp' });
  const plateIn = scrollY.interpolate({
    inputRange: [RIDE_AT - 40, RIDE_AT + 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  /** Every press that leaves this screen answers the finger first. */
  const go = (href: string) => {
    haptic('tap');
    router.push(href as never);
  };

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
  });

  // Shops the customer has connected to — same cache key the Shops tab, the
  // shop page and the QR scanner invalidate, so a new connection lands here
  // without the customer hunting for it.
  const {
    data: shops,
    isLoading: areShopsLoading,
    error: shopsError,
  } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  // The laundries actually used, newest first, each carrying last time's load.
  const recent = useMemo(() => recentShops(orders ?? []), [orders]);
  const quickBook = useMemo(() => quickBookTarget(recent, shops ?? []), [recent, shops]);

  // "Your shops" lists the rest, so a laundry is never on the sheet twice.
  const { tiles: shopTiles, hiddenCount: hiddenShopCount } = useMemo(() => {
    const recentIds = new Set(recent.map((shop) => shop.shopId));
    return connectedShopTiles((shops ?? []).filter((shop) => !recentIds.has(shop.id)));
  }, [shops, recent]);
  const hasAnyShop = (shops ?? []).length > 0 || recent.length > 0;

  // Assigned across the whole shelf, so no two shops on it share a tone.
  const railShops = useMemo<RailShop[]>(() => {
    const now = new Date();
    const used = recent.map((shop) => ({
      id: shop.shopId,
      name: shop.name,
      logoUrl: shop.logoUrl || null,
      coverUrl: shop.coverUrl || null,
      brand_accent: shop.brandAccent,
      meta: shop.lastSummary
        ? `Last: ${shop.lastSummary}`
        : `Last order ${formatOrderTime(shop.lastOrderAt, now)}`,
      rebookHref: shop.rebookHref,
    }));
    const others = shopTiles.map((shop) => ({
      id: shop.id,
      name: shop.name,
      logoUrl: shop.logo_url,
      coverUrl: shop.cover_url || null,
      brand_accent: shop.brand_accent,
      meta: shop.address,
      rebookHref: null,
    }));
    const all = [...used, ...others];
    const accents = assignBrandAccents(all, ACCENTS.length);
    return all.map(({ brand_accent: _unused, ...shop }, index) => ({
      ...shop,
      accent: ACCENTS[accents[index]],
    }));
  }, [recent, shopTiles]);

  // Orders the customer cleared stay off both lists. Bills are built from
  // every order below, so clearing a load never hides money still owed.
  const { active, past } = useMemo(() => {
    const shown = (orders ?? []).filter((order) => !hiddenIds.has(order.id));
    return {
      active: shown.filter((order) => !TERMINAL_STATUSES.includes(order.status)),
      past: shown.filter((order) => TERMINAL_STATUSES.includes(order.status)),
    };
  }, [orders, hiddenIds]);

  /** Clears orders off home, after asking — one row, or the whole past list. */
  const removeFromHome = (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    confirmAction(hideOrderPrompt(orderIds.length), () => {
      haptic('select');
      if (!isReduced) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      hide(orderIds);
    });
  };

  const subline = useMemo(() => homeSubline(active.map(toHeadlineOrder)), [active]);
  // Ticks, so "back today by 6 PM" turns into "running late" without a pull to refresh.
  const now = useNow();

  // The sign on each shop's door, on the same ticking clock, so "Closing soon"
  // turns into "Closed" while the screen stays open. A recent shop the
  // customer is no longer connected to has no row here and shows no sign.
  const litShops = useMemo<RailShop[]>(() => {
    const byId = new Map((shops ?? []).map((shop) => [shop.id, shop]));
    return railShops.map((shop) => {
      const row = byId.get(shop.id);
      return { ...shop, status: row ? shopStatus(readAvailability(row), now) : null };
    });
  }, [railShops, shops, now]);

  // Built from the same orders the screen already has, so the number on the
  // bell and the feed behind it cannot drift apart.
  // Filtered by the customer's notification settings for the same reason: the
  // bell must count what the feed will actually show them.
  const alertCount = useMemo(
    () =>
      actionableCount(
        enabledNotifications(
          buildNotifications(
            (orders ?? []).map((order) => ({
              id: order.id,
              shopName: order.shop?.name ?? 'Laundry shop',
              status: order.status,
              order_type: order.order_type,
              fulfillment: order.fulfillment,
              payment_status: order.payment_status,
              estimated_total: order.estimated_total,
              final_total: order.final_total,
              updated_at: order.updated_at,
            }))
          ),
          settings
        )
      ),
    [orders, settings]
  );


  // The ping. Derived from the same orders as the bell, through the same
  // proof-state the pay screen reads, so the three can never disagree about
  // whether money is owed.
  const attention = useMemo(
    () =>
      homeAttention(
        (orders ?? []).map((order) => ({
          id: order.id,
          shopName: order.shop?.name ?? 'Laundry shop',
          customer_id: order.customer_id,
          status: order.status,
          order_type: order.order_type,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          final_total: order.final_total,
          payment_proof_path: order.payment_proof_path,
          updated_at: order.updated_at,
        }))
      ),
    [orders]
  );

  if (isLoading) {
    return (
      <View style={styles.page}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {/* The field is the page, not a band across the top of it. */}
      <BlueField />
      <StatusBar style="light" />

      {/* Pinned: the two ways off this screen must not scroll away with the
          greeting. The plate behind them fades in as the white sheet rises, so
          the glyphs sit on blue at every scroll position rather than turning
          white-on-white halfway down. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.topPlate, { opacity: plateIn }]}
        />
        {/* Nothing on the left. The page does not need to tell you whose app
            you opened; the greeting already speaks to you by name. */}
        <View style={{ flex: 1 }} />
        <NotificationBell
          count={alertCount}
          onPress={() => go('/(customer)/notifications')}
        />
        {/* Second, and never first: the bell is where something has happened,
            settings is where you go on purpose. Same glass, so the pair reads
            as one set of ways out rather than two decisions. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={() => go('/(customer)/settings')}
          style={({ pressed }) => [styles.bell, styles.avatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.avatarText}>{initialsOf(profile?.full_name)}</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + TOP_BAR_HEIGHT + GREETING_DROP },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* The greeting lags the scroll and dims as the sheet rides over it:
            one movement, and the only one on this page a finger drives. */}
        <Animated.View
          style={[styles.greeting, { opacity: greetFade, transform: [{ translateY: greetLag }] }]}
        >
          {/* One sentence, three weights. "Hi" is the smallest thing on the
              block because it is the least of what is being said; the reader's
              own name carries the weight; and the connector takes the accent,
              which is what makes the two rows read as one sentence broken
              across them rather than as two stacked lines. */}
          <Text style={styles.dateLine}>{dateLine(now)}</Text>
          <Text style={styles.headline} accessibilityRole="header" numberOfLines={2}>
            Hi, {greeting.name}
          </Text>
          <Text style={styles.state}>{subline}</Text>
        </Animated.View>

        {/* Everything there is to read rides on white. */}
        <Animated.View
          style={[
            styles.sheet,
            { borderTopLeftRadius: sheetRadius, borderTopRightRadius: sheetRadius },
          ]}
        >
      {/* The light the glass on this sheet frosts over. */}
      <PastelWash />
      {/* The laundries lead the sheet: they are what this app is for, and
          every other section here — the loads, the reorder, the history — is
          something one of them is doing for you. One shelf, recent first,
          each shop's logo behind a washing machine's door. */}
      {shopsError ? <ErrorText>{(shopsError as Error).message}</ErrorText> : null}
      {hasAnyShop ? (
        <>
          <SectionHead
            title="Your Laundries"
            linkLabel={hiddenShopCount > 0 ? `See All (${hiddenShopCount})` : 'See All'}
            onLink={() => go('/(customer)/shops')}
          />
          <ShopRail
            shops={litShops}
            onOpen={(shopId) => go(`/(customer)/shop/${shopId}`)}
            onRebook={go}
          />
        </>
      ) : (
        !areShopsLoading && (
          <View style={styles.panel}>
            <EmptyState message="Connect to a laundry shop and it will show up here every time you open the app." />
            <Button title="Find a laundry shop" onPress={() => go('/(customer)/shops')} />
          </View>
        )
      )}

      {/* The ping: what is owed, straight under the shops and before anything
          the customer might browse to. A bill is the one thing on this screen
          the shop is waiting on. */}
      {attention.map((card) => (
        <AttentionBanner
          key={`${card.orderId}:${card.kind}`}
          card={card}
          onPress={() => go(`/(customer)/order/${card.orderId}`)}
        />
      ))}

      {error ? <ErrorText>{error.message}</ErrorText> : null}

      {/* Tracking first: a load already in a machine outranks anything the
          customer might browse to. It used to sit under two shop lists, below
          the fold. Suppressed when empty — the greeting already says so. */}
      {active.length > 0 && (
        <>
          {/* Named for the whole list, not the wash: a load that is booked or
              ready is on the go too. */}
          <SectionHead title="In Progress" />
          <LaundryLine
            orders={active}
            now={now}
            shopFor={(order) => ({
              name: order.shop?.name ?? 'Laundry shop',
              logoUrl: order.shop?.logo_url ?? null,
              accent:
                ACCENTS[
                  resolveAccent(
                    {
                      id: order.shop?.id ?? order.shop_id,
                      brand_accent: order.shop?.brand_accent ?? null,
                    },
                    ACCENTS.length
                  )
                ],
            })}
            onOpen={(order) => go(`/(customer)/order/${order.id}`)}
          />
        </>
      )}

      {/* "Buy it again": last time's load, landing on a filled review. The one
          filled block on the sheet, because reordering is what most visits
          are for. Absent for a customer with no shop; the empty state covers
          that. */}
      {quickBook.kind !== 'find' && (
        <View style={styles.quickWrap}>
          <QuickBookCard target={quickBook} onPress={() => go(quickBook.href)} />
        </View>
      )}

      {past.length > 0 && (
        <>
          <PastOrdersToggle count={past.length} isOpen={isPastOpen} onToggle={togglePast} />
          {isPastOpen ? (
            <>
              <View style={styles.group}>
                {past.map((order, index) => (
                  <PastOrderRow
                    key={order.id}
                    isFirst={index === 0}
                    order={order}
                    onPress={() => go(`/(customer)/order/${order.id}`)}
                    onRemove={
                      canHideOrder(order.status) ? () => removeFromHome([order.id]) : undefined
                    }
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Clear all ${past.length} past orders from home`}
                hitSlop={8}
                onPress={() =>
                  removeFromHome(past.filter((o) => canHideOrder(o.status)).map((o) => o.id))
                }
                style={({ pressed }) => [styles.clearPast, pressed && styles.pastPressed]}
              >
                <Text style={styles.clearPastText}>Clear past orders</Text>
              </Pressable>
            </>
          ) : null}
        </>
      )}

      {/* Sign-out used to end this list. Where it landed depended on how many
          orders you had, and it took one tap with nothing between it and a
          lost session — it lives on the settings screen now, behind the gear
          in the top bar and behind a confirmation. */}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

/**
 * The bell, on the top bar opposite the mark.
 *
 * It is glass rather than a filled button: it is a way *out* of this screen,
 * not the thing this screen is for, and the one filled shape on the field has
 * to stay "Book a pickup". The dot is amber — the app's colour for something
 * outstanding — with a ring so it separates from the blue behind it, and the
 * count is repeated in the accessible label, since a dot announces nothing.
 */
function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  const badge = badgeLabel(count);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bellLabel(count)}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={badge ? 'notifications' : 'notifications-outline'}
        size={22}
        color={colors.onAccent}
      />
      {badge ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The ping itself: one bill (or one receipt-in-review), pressed on the
 * customer rather than waiting behind the bell.
 *
 * A bill is set in the app's action blue — the same tone the notification
 * feed gives its one actionable row — and a receipt being checked drops to
 * paper quiet, because it asks nothing. The whole card is the button; the
 * chevron says it goes somewhere, and where it goes is the order's own pay
 * screen.
 */
function AttentionBanner({
  card,
  onPress,
}: {
  card: AttentionCard;
  onPress: () => void;
}) {
  const isPay = card.kind === 'pay';

  if (isPay) {
    // A bill is the one thing here the shop is waiting on, so it is dressed
    // as one: the amber every owed amount wears, the amount at headline size,
    // and a button that says what pressing it does.
    return (
      <LiftPressable
        accessibilityRole="button"
        accessibilityLabel={`${card.title}. ${card.body}`}
        onPress={onPress}
        style={styles.bill}
      >
        <View style={styles.billHead}>
          <View style={styles.billIcon}>
            <Ionicons name={card.icon as never} size={16} color={colors.onAccent} />
          </View>
          <Text style={styles.billEyebrow}>Payment Due</Text>
        </View>
        <Text style={styles.billTitle} numberOfLines={1} adjustsFontSizeToFit>
          {card.title}
        </Text>
        <Text style={styles.billBody}>{card.body}</Text>
        {card.cta ? (
          <View style={styles.billButton}>
            <Text style={styles.billButtonText}>{card.cta}</Text>
          </View>
        ) : null}
      </LiftPressable>
    );
  }

  return (
    <LiftPressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.body}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.attention,
        isPay ? styles.attentionPay : styles.attentionQuiet,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={card.icon as never}
        size={22}
        color={isPay ? colors.actionInk : colors.subtle}
      />
      <View style={styles.attentionText}>
        <Text
          style={[styles.attentionTitle, isPay && { color: colors.actionInk }]}
          numberOfLines={1}
        >
          {card.title}
        </Text>
        <Text style={styles.attentionBody} numberOfLines={2}>
          {card.body}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={isPay ? colors.actionInk : colors.subtle}
      />
    </LiftPressable>
  );
}

/**
 * A section's title, the way a store page titles its shelves: sentence case at
 * reading weight, with a count or a way to see everything on the right.
 *
 * These were tracked grey caps — RECENT SHOPS, OTHER SHOPS — which read as
 * form labels, not as the headings of a page about the customer's laundry.
 */
/**
 * The past orders' heading, and the switch that shows them. The whole row is
 * the target, and the count rides beside the title so a closed list still says
 * how much is behind it.
 */
function PastOrdersToggle({
  count,
  isOpen,
  onToggle,
}: {
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Past orders, ${count}`}
      accessibilityHint={isOpen ? 'Hides your past orders' : 'Shows your past orders'}
      accessibilityState={{ expanded: isOpen }}
      onPress={onToggle}
      hitSlop={8}
      style={({ pressed }) => [styles.sectionHead, pressed && styles.pastPressed]}
    >
      <View style={styles.pastTitleRow}>
        <Text style={styles.sectionTitle}>Past Orders</Text>
        <Text style={styles.pastCountText}>{count}</Text>
      </View>
      <Text style={styles.sectionLink}>{isOpen ? 'Hide' : 'Show'}</Text>
    </Pressable>
  );
}

function SectionHead({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {linkLabel && onLink ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onLink} style={styles.sectionLinkRow}>
          <Text style={styles.sectionLink}>{linkLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PastOrderRow({
  isFirst,
  order,
  onPress,
  onRemove,
}: {
  isFirst: boolean;
  order: OrderWithDetails;
  onPress: () => void;
  /** Absent when the order cannot be cleared. */
  onRemove?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.shop?.name ?? 'Laundry shop'}, ${
        STATUS_LABELS[order.status]
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.pastRow, pressed && styles.rowPressed]}
    >
      {isFirst ? null : <View style={styles.separator} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.shopName} numberOfLines={1}>
          {order.shop?.name ?? 'Laundry shop'}
        </Text>
        <Text style={styles.shopAddress}>
          {formatMoney(order.final_total ?? order.estimated_total)} ·{' '}
          {formatOrderTime(order.created_at, new Date())}
        </Text>
      </View>
      <Text style={[styles.pastStatus, { color: STATUS_COLORS[order.status] }]}>
        {STATUS_LABELS[order.status]}
      </Text>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${order.shop?.name ?? 'this'} order from home`}
          hitSlop={10}
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, pressed && styles.pastPressed]}
        >
          <Ionicons name="close-circle" size={20} color={CHEVRON} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={CHEVRON} />
      )}
    </Pressable>
  );
}

/** The accent block the drum sits in — the ticket's band, stood on its end. */
const BLOCK_WIDTH = 76;
/** How far the punched holes bite in at the seam. */
const STUB_NOTCH = 16;

const styles = StyleSheet.create({
  /**
   * A load in the wash. Roughly a third of the height the old tracker card
   * took, so three loads are a glanceable list rather than three screenfuls.
   */
  stub: {
    flexDirection: 'row',
    // Paper, like the ticket it is a stub of, rather than another white card.
    backgroundColor: colors.paper,
    borderRadius: 16,
    // Clips the block and the punched holes to the card's own shape.
    overflow: 'hidden',
    ...elevation.lift,
  },
  /** The laundry's colour, and the drum that turns when the machine does. */
  stubBlock: {
    width: BLOCK_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Page-coloured holes punched at the seam; the card's clip does the cutting. */
  stubNotch: {
    position: 'absolute',
    left: BLOCK_WIDTH - STUB_NOTCH / 2,
    width: STUB_NOTCH,
    height: STUB_NOTCH,
    borderRadius: STUB_NOTCH / 2,
    backgroundColor: colors.bg,
  },
  stubNotchTop: { top: -STUB_NOTCH / 2 },
  stubNotchBottom: { bottom: -STUB_NOTCH / 2 },
  /** The tear line between the block and the body, inset past both punches. */
  stubSeam: {
    position: 'absolute',
    left: BLOCK_WIDTH,
    top: STUB_NOTCH / 2,
    bottom: STUB_NOTCH / 2,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paperRule,
  },
  stubBody: { flex: 1, paddingHorizontal: space.room, paddingVertical: space.cosy, gap: space.snug },
  stubHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  stubShop: { flex: 1, ...type.section, fontSize: 17, color: colors.text },
  /** The same number, in the same face, as the ticket this is a stub of. */
  stubDocket: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: colors.subtle },
  stubTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.paperRule,
    overflow: 'hidden',
  },
  stubFill: { height: 5, borderRadius: 3 },
  stubFoot: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  // The state, in the state's own colour, set the way a ticket sets a class of
  // travel. It does the badge's job, so the row carries no second object.
  stubStage: {
    ...type.label,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stubStep: { fontFamily: mono, fontSize: 11, color: colors.subtle },
  // `auto` rather than a flexed sibling: the step text is absent before the
  // cycle starts, and the figure has to hold the right edge either way.
  stubAmount: {
    marginLeft: 'auto',
    fontFamily: mono,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  /** The page itself: blue to every edge, with the field painted on it. */
  page: { flex: 1, backgroundColor: BLUE_FIELD.deep },
  /**
   * `flexGrow` so a customer with one shop and no orders still gets a white
   * sheet that reaches the bottom of the glass rather than a white card
   * floating halfway down a blue page.
   */
  scroll: { flexGrow: 1 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    height: undefined,
    paddingHorizontal: space.room,
    paddingBottom: space.snug,
  },
  /** The bar's own ground, faded in under it once the sheet has risen. */
  topPlate: { backgroundColor: BLUE_FIELD.deep },

  greeting: {
    paddingHorizontal: space.section,
    paddingBottom: space.gulf + space.snug,
    gap: space.tight,
  },
  /** Apple's Today eyebrow: the date, small caps-height, over the title. */
  dateLine: {
    ...type.caption,
    ...fontFor(600),
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  headline: {
    ...type.hero,
    color: colors.onAccent,
  },
  state: {
    ...type.body,
    fontSize: 17,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: space.tight,
  },
  /** What the page is made of, riding on the light. */
  sheet: {
    borderCurve: 'continuous',
    flexGrow: 1,
    backgroundColor: GLASS_GROUND,
    overflow: 'hidden',
    paddingHorizontal: space.room,
    paddingTop: space.section + space.tight,
    paddingBottom: space.gulf * 2,
    gap: space.cosy,
  },

  // 44pt: the smallest target a thumb can hit reliably, and enough glass for
  // the glyph to read as a control rather than as decoration on the field.
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  /** The account button: initials on a frosted disc, as the App Store sets it. */
  avatar: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  avatarText: { fontSize: 15, letterSpacing: 0.2, ...fontFor(600), color: colors.onAccent },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    // A ring in the hero's own blue, so the dot reads as sitting on the bell
    // rather than floating somewhere behind it.
    borderWidth: 2,
    borderColor: BLUE_FIELD.deep,
  },
  // #3B2400 on #F5A623 is 8.4:1 — a 12px bold count has to survive sunlight.
  // The iOS notification badge: system red, white count.
  bellBadgeText: { fontSize: 11, lineHeight: 13, ...fontFor(600), color: colors.onAccent },

  /** The quiet ping: a receipt being checked asks nothing, so it is a plain row. */
  attention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
    ...glassPane,
  },
  attentionPay: {},
  attentionQuiet: {},
  attentionText: { flex: 1, gap: 2 },

  /** A bill, set like a Wallet pass: white, the amount large, one blue button. */
  bill: {
    ...glassPane,
    gap: space.snug,
    padding: space.room + 2,
  },
  billHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  billIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9500',
  },
  billEyebrow: { ...type.body, fontSize: 15, ...fontFor(600), color: colors.moneyOut },
  billTitle: { ...type.title, color: colors.text },
  billBody: { ...type.body, fontSize: 15, lineHeight: 20, color: colors.subtle },
  billButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: space.snug,
    borderRadius: RADII.control,
    borderCurve: 'continuous',
    backgroundColor: colors.action,
  },
  billButtonText: { fontSize: 17, letterSpacing: -0.3, ...fontFor(600), color: colors.onAccent },
  attentionTitle: { ...type.body, fontSize: 17, ...fontFor(600), color: colors.text },
  attentionBody: { ...type.caption, fontSize: 14, color: colors.subtle },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.cosy,
    marginTop: space.cosy,
  },
  sectionTitleBlock: { flexShrink: 1, gap: 2 },
  sectionTitle: { ...type.section, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.text },
  sectionLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionLink: { ...type.body, fontSize: 17, color: colors.actionInk },
  pastPressed: { opacity: 0.7 },
  pastTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  pastCountText: { ...type.section, fontSize: 22, lineHeight: 28, ...fontFor(400), color: colors.subtle },
  quickWrap: { marginTop: space.snug },

  panel: {
    ...glassPane,
    padding: space.room,
    gap: space.cosy,
  },

  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  shopName: { ...type.body, fontSize: 17, color: colors.text },
  shopAddress: { ...type.caption, fontSize: 14, color: colors.subtle },

  /** One grouped list, as Settings sets a run of rows. */
  group: {
    ...glassPane,
    overflow: 'hidden',
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    minHeight: 60,
    paddingVertical: space.snug + 2,
    paddingLeft: space.room,
    paddingRight: space.cosy,
  },
  rowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  separator: {
    position: 'absolute',
    top: 0,
    left: space.room,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60, 60, 67, 0.22)',
  },
  pastStatus: { ...type.caption, fontSize: 14, ...fontFor(500) },
  removeButton: { padding: 2 },
  clearPast: { alignSelf: 'center', paddingVertical: space.snug },
  clearPastText: { ...type.body, fontSize: 15, color: colors.dangerInk },

});
