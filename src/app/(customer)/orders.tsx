import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlueField } from '@/components/blue-field';
import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import { OrderStub } from '@/components/order-stub';
import { QuickBookCard, RecentShopRow } from '@/components/quick-book';
import {
  ACCENTS,
  BLUE_FIELD,
  Button,
  EmptyState,
  ErrorText,
  Loading,
  STATUS_LABELS,
  StatusBadge,
  colors,
  elevation,
  formatMoney,
  mono,
  space,
  type,
} from '@/components/ui-kit';
import { ShopLogo } from '@/components/shop-logo';
import { getMyOrders, getRegisteredShops, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { assignBrandAccents, resolveAccent } from '@/lib/domain/shop-branding';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import {
  connectedShopTiles,
  type ConnectedShopTile,
} from '@/lib/domain/connected-shops';
import {
  homeAttention,
  type AttentionCard,
} from '@/lib/domain/home-attention';
import { homeGreeting } from '@/lib/domain/home-greeting';
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

function toHeadlineOrder(order: OrderWithDetails): HeadlineOrder {
  return {
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    shopName: order.shop?.name ?? 'Laundry shop',
  };
}

export default function CustomerOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const haptic = useHaptic();
  const { profile } = useAuth();
  const isReduced = useReducedMotion();

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
  const recentAccents = useMemo(
    () =>
      assignBrandAccents(
        recent.map((shop) => ({ id: shop.shopId, brand_accent: shop.brandAccent })),
        ACCENTS.length
      ),
    [recent]
  );

  // "Your shops" lists the rest, so a laundry is never on the sheet twice.
  const { tiles: shopTiles, hiddenCount: hiddenShopCount } = useMemo(() => {
    const recentIds = new Set(recent.map((shop) => shop.shopId));
    return connectedShopTiles((shops ?? []).filter((shop) => !recentIds.has(shop.id)));
  }, [shops, recent]);
  const hasAnyShop = (shops ?? []).length > 0 || recent.length > 0;

  const { active, past } = useMemo(() => {
    const all = orders ?? [];
    return {
      active: all.filter((order) => !TERMINAL_STATUSES.includes(order.status)),
      past: all.filter((order) => TERMINAL_STATUSES.includes(order.status)),
    };
  }, [orders]);

  const subline = useMemo(() => homeSubline(active.map(toHeadlineOrder)), [active]);

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

  // Assigned across the whole list, so no two shops on screen share a tone.
  const shopAccents = useMemo(
    () =>
      assignBrandAccents(
        shopTiles.map((shop) => ({ id: shop.id, brand_accent: shop.brand_accent })),
        ACCENTS.length
      ),
    [shopTiles]
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
          style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.onAccent} />
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
          <Text style={styles.hello} accessibilityRole="header">
            Hi <Text style={styles.helloName}>{greeting.name}</Text>,
          </Text>
          <Text style={styles.headline}>
            <Text style={styles.headlineLead}>{greeting.lead}</Text> {greeting.rest}
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
      {/* The ping: what is owed, first thing on the sheet, before anything the
          customer might browse to. A bill is the one thing on this screen the
          shop is waiting on. */}
      {attention.map((card) => (
        <AttentionBanner
          key={`${card.orderId}:${card.kind}`}
          card={card}
          onPress={() => go(`/(customer)/order/${card.orderId}`)}
        />
      ))}

      {/* Quick book: the fastest way from opening the app to a booking —
          last time's load, landing on a filled review. Absent for a customer
          with no shop at all; the empty state below already says what to do. */}
      {quickBook.kind !== 'find' && (
        <QuickBookCard target={quickBook} onPress={() => go(quickBook.href)} />
      )}

      {/* The laundries actually used, most recent first, each one tap from
          booking the same thing again. */}
      {recent.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>RECENT SHOPS</Text>
          {recent.map((shop, index) => {
            const href = shop.rebookHref;
            return (
              <RecentShopRow
                key={shop.shopId}
                shop={shop}
                accent={ACCENTS[recentAccents[index]]}
                onOpen={() => go(`/(customer)/shop/${shop.shopId}`)}
                onBook={href ? () => go(href) : undefined}
              />
            );
          })}
        </>
      )}

      {/* Connected shops: the customer's own laundries, one tap from home. */}
      {(shopTiles.length > 0 || !hasAnyShop) && (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>
            {recent.length > 0 ? 'OTHER SHOPS' : 'YOUR SHOPS'}
          </Text>
          {hiddenShopCount > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all shops, ${hiddenShopCount} more`}
              hitSlop={12}
              onPress={() => go('/(customer)/shops')}
            >
              <Text style={styles.sectionLink}>See all ({hiddenShopCount} more)</Text>
            </Pressable>
          )}
        </View>
      )}
      {shopsError ? <ErrorText>{(shopsError as Error).message}</ErrorText> : null}
      {!hasAnyShop && !areShopsLoading && (
        <View style={styles.panel}>
          <EmptyState message="Connect to a laundry shop and it will show up here every time you open the app." />
          <Button
            title="Find a laundry shop"
            onPress={() => go('/(customer)/shops')}
          />
        </View>
      )}
      {shopTiles.map((shop, index) => (
        <Reveal key={shop.id} delay={index * REVEAL_STAGGER_MS}>
          <ShopShortcut
            shop={shop}
            accent={ACCENTS[shopAccents[index]]}
            onPress={() => go(`/(customer)/shop/${shop.id}`)}
          />
        </Reveal>
      ))}

      {error ? <ErrorText>{error.message}</ErrorText> : null}

      {/* Tracking. Suppressed when empty — the hero already says so, and two
          statements of absence on one screen is one too many. */}
      {active.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>IN THE WASH</Text>
          {active.map((order) => (
            <OrderStub
              key={order.id}
              order={order}
              shopName={order.shop?.name ?? 'Laundry shop'}
              accent={
                ACCENTS[
                  resolveAccent(
                    {
                      id: order.shop?.id ?? order.shop_id,
                      brand_accent: order.shop?.brand_accent ?? null,
                    },
                    ACCENTS.length
                  )
                ]
              }
              onPress={() => go(`/(customer)/order/${order.id}`)}
            />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PAST ORDERS</Text>
          {past.map((order) => (
            <PastOrderRow
              key={order.id}
              order={order}
              onPress={() => go(`/(customer)/order/${order.id}`)}
            />
          ))}
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

  return (
    <Pressable
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
    </Pressable>
  );
}

/**
 * A card that answers the finger.
 *
 * Dimming to 0.75 on press said "something registered" but not "this is a
 * physical object". Pressing *in* does, and it survives the hundredth use
 * because it is feedback rather than a performance — the smallest change that
 * makes cause and result unmistakable.
 */
function usePress() {
  const isReduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const to = (value: number) => {
    if (isReduced) return;
    Animated.spring(scale, {
      toValue: value,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  return {
    scale,
    onPressIn: () => to(0.97),
    onPressOut: () => to(1),
  };
}

/**
 * Colour as identity: a shop keeps its tone, so the list is scannable by hue
 * before it is read. The initials carry the same job for anyone who cannot
 * separate the colours.
 */
function ShopShortcut({
  shop,
  accent,
  onPress,
}: {
  shop: ConnectedShopTile;
  accent: (typeof ACCENTS)[number];
  onPress: () => void;
}) {
  const press = usePress();

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.panel, styles.shopRow]}
      >
        <ShopLogo name={shop.name} logoUrl={shop.logo_url} size={44} accent={accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.address ? (
            <Text style={styles.shopAddress} numberOfLines={1}>
              {shop.address}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
      </Pressable>
    </Animated.View>
  );
}

function PastOrderRow({
  order,
  onPress,
}: {
  order: OrderWithDetails;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.shop?.name ?? 'Laundry shop'}, ${
        STATUS_LABELS[order.status]
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.panel, styles.pastRow, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.shopName} numberOfLines={1}>
          {order.shop?.name ?? 'Laundry shop'}
        </Text>
        <Text style={styles.shopAddress}>
          {formatMoney(order.final_total ?? order.estimated_total)} ·{' '}
          {formatOrderTime(order.created_at, new Date())}
        </Text>
      </View>
      <StatusBadge status={order.status} />
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
    paddingBottom: space.gulf + space.cosy,
    gap: space.tight,
  },
  /**
   * The half of the headline that belongs to the reader, set a step down from
   * the half that belongs to the page — one block, two voices, no eyebrow.
   */
  hello: {
    ...type.title,
    fontSize: 30,
    lineHeight: 36,
    // The greeting word, not the greeting: one step back from the name so the
    // name is what the eye lands on.
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.78)',
  },
  /** The reader's own name, at full strength and full weight. */
  helloName: {
    ...type.hero,
    fontSize: 30,
    lineHeight: 36,
    color: colors.onAccent,
  },
  headline: {
    ...type.hero,
    fontSize: 34,
    lineHeight: 40,
    color: colors.onAccent,
  },
  /**
   * The connector, in the app's own `actionMuted` rather than an invented
   * pastel — the tint the design system already spends on blue-at-rule-weight,
   * which is exactly this relationship: present, quieter, unmistakably the
   * same family. 10:1 on the deep ground and 3.5:1 on the lit corner, against
   * the 3:1 a 34pt line needs.
   */
  headlineLead: {
    ...type.hero,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '400',
    color: colors.actionMuted,
  },
  state: {
    ...type.body,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: space.cosy,
  },
  /** What the page is made of, riding on the light. */
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.room,
    paddingTop: space.room,
    // Clear of the raised tab button at the foot of the screen.
    paddingBottom: space.gulf * 3,
    gap: space.cosy,
  },

  // 44pt: the smallest target a thumb can hit reliably, and enough glass for
  // the glyph to read as a control rather than as decoration on the field.
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5A623',
    // A ring in the hero's own blue, so the dot reads as sitting on the bell
    // rather than floating somewhere behind it.
    borderWidth: 2,
    borderColor: BLUE_FIELD.deep,
  },
  // #3B2400 on #F5A623 is 8.4:1 — a 12px bold count has to survive sunlight.
  bellBadgeText: { fontSize: 11, fontWeight: '800', color: '#3B2400' },

  /** The ping: a full-width row the thumb cannot miss. */
  attention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
  },
  attentionPay: {
    backgroundColor: colors.actionSurface,
    borderColor: colors.actionMuted,
  },
  attentionQuiet: {
    backgroundColor: colors.sunken,
    borderColor: colors.border,
  },
  attentionText: { flex: 1, gap: 2 },
  attentionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  attentionBody: { fontSize: 13, color: colors.subtle },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.cosy,
    marginTop: space.snug,
  },
  /** Tracked caps: a quiet index mark, so the content is what carries weight. */
  sectionLabel: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.subtle,
    marginTop: space.snug,
  },
  sectionLink: { ...type.label, color: colors.actionInk },

  panel: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
    ...elevation.rest,
  },

  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  shopName: { ...type.label, fontSize: 16, color: colors.text },
  shopAddress: { ...type.caption, color: colors.subtle },

  pastRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },

});
