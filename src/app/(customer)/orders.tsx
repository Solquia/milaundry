import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import { WashCycleTracker } from '@/components/wash-cycle-tracker';
import { WasherMark } from '@/components/washer-mark';
import {
  ACCENTS,
  Button,
  EmptyState,
  ErrorText,
  HERO_GRADIENT,
  Loading,
  STATUS_LABELS,
  Screen,
  StatusBadge,
  colors,
  elevation,
  formatMoney,
  space,
  type,
} from '@/components/ui-kit';
import { getMyOrders, getRegisteredShops, type OrderWithDetails } from '@/lib/api';
import { assignAccents } from '@/lib/domain/accent';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import {
  connectedShopTiles,
  type ConnectedShopTile,
} from '@/lib/domain/connected-shops';
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

/**
 * The two actions that actually go somewhere. Booking lives in the hero, and
 * tracking lives on the shop whose laundry it is — a load belongs to a shop,
 * so that is where "where is it?" gets answered.
 */
const ACTIONS = [
  {
    key: 'scan',
    icon: 'qr-code',
    label: 'Scan QR',
    caption: 'Connect to a shop',
    href: '/(customer)/scan',
  },
  {
    key: 'shops',
    icon: 'storefront',
    label: 'Shops',
    caption: 'Find a laundry',
    href: '/(customer)/shops',
  },
] as const;

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

  const { tiles: shopTiles, hiddenCount: hiddenShopCount } = useMemo(
    () => connectedShopTiles(shops ?? []),
    [shops]
  );

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


  // Assigned across the whole list, so no two shops on screen share a tone.
  const shopAccents = useMemo(
    () => assignAccents(shopTiles.map((shop) => shop.id), ACCENTS.length),
    [shopTiles]
  );

  if (isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* The hero owns the top edge, so the status bar sits on deep blue. */}
      <StatusBar style="light" />

      <HomeHero
        insetTop={insets.top}
        subline={subline}
        isAnythingWashing={active.length > 0}
        alertCount={alertCount}
        onBook={() => {
          // The one press on this screen that starts something, so it lands
          // heavier than the presses that only move you somewhere.
          haptic('commit');
          router.push('/(customer)/shops' as never);
        }}
        onOpenNotifications={() => go('/(customer)/notifications')}
        onOpenSettings={() => go('/(customer)/settings')}
      />

      {/* These two arrive as a pair, so they arrive in sequence. */}
      <View style={styles.actionRow}>
        {ACTIONS.map((action, index) => (
          <Reveal
            key={action.key}
            delay={index * REVEAL_STAGGER_MS}
            style={styles.actionShell}
          >
            <ActionCard
              icon={action.icon}
              label={action.label}
              caption={action.caption}
              onPress={() => go(action.href)}
            />
          </Reveal>
        ))}
      </View>

      {/* Connected shops: the customer's own laundries, one tap from home. */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>YOUR SHOPS</Text>
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
      {shopsError ? <ErrorText>{(shopsError as Error).message}</ErrorText> : null}
      {shopTiles.length === 0 && !areShopsLoading && (
        <View style={styles.panel}>
          <EmptyState message="Connect to a laundry shop and it will show up here every time you open the app." />
          <Button
            title="Find a laundry shop"
            onPress={() => go('/(customer)/shops')}
          />
        </View>
      )}
      {shopTiles.map((shop, index) => (
        <Reveal key={shop.id} delay={(index + ACTIONS.length) * REVEAL_STAGGER_MS}>
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
            <TrackerCard
              key={order.id}
              order={order}
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
          in the hero and behind a confirmation. */}
    </Screen>
  );
}

/**
 * The one surface that owns the screen. It bleeds past the page gutter and up
 * behind the status bar, so the app opens on colour rather than on a card
 * floating in a field, and it leads with the answer instead of the wordmark.
 */
function HomeHero({
  insetTop,
  subline,
  isAnythingWashing,
  alertCount,
  onBook,
  onOpenNotifications,
  onOpenSettings,
}: {
  insetTop: number;
  subline: string;
  isAnythingWashing: boolean;
  alertCount: number;
  onBook: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}) {
  // Percentage sizing on <Svg> does not resolve against a flex parent in
  // react-native-svg — it painted a fixed viewport and left bare edges. Measure
  // the box and paint in real pixels. The container also carries a solid mid
  // stop, so the surface is never white for a frame or at a rounded corner.
  const [field, setField] = useState({ width: 0, height: 0 });

  return (
    <View
      // The inset only clears the status bar; everything above it here is what
      // keeps the mark off the clock and out from under a punch-hole camera.
      style={[styles.hero, { paddingTop: insetTop + space.gulf + space.cosy }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setField((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
        );
      }}
    >
      {field.width > 0 && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={field.width}
          height={field.height}
          pointerEvents="none"
        >
          <Defs>
            {/* Lower left to upper right: the lightest stop lands in the
                corner the eye reaches first, and the depth pools underneath. */}
            <SvgLinearGradient id="heroField" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={HERO_GRADIENT[0]} />
              <Stop offset="0.55" stopColor={HERO_GRADIENT[1]} />
              <Stop offset="1" stopColor={HERO_GRADIENT[2]} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={field.width}
            height={field.height}
            fill="url(#heroField)"
          />
        </Svg>
      )}

      {/* The wordmark is the heading; the drum beside it turns only while
          something of yours is actually being washed. */}
      <View style={styles.heroBrandRow}>
        <WasherMark size={34} isRunning={isAnythingWashing} />
        <Text style={styles.heroWordmark} accessibilityRole="header">
          MiLaundry
        </Text>
        <View style={{ flex: 1 }} />
        <NotificationBell count={alertCount} onPress={onOpenNotifications} />
        {/* Second, and never first: the bell is where something has happened,
            settings is where you go on purpose. Same glass treatment, so the
            pair reads as one set of ways out rather than two decisions. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.onAccent} />
        </Pressable>
      </View>

      <Text style={styles.heroDetail}>{subline}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Book a pickup"
        onPress={onBook}
        style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.heroCtaText}>Book a pickup</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.actionInk} />
      </Pressable>
    </View>
  );
}

/**
 * The bell, sitting on the hero opposite the wordmark.
 *
 * It is glass rather than a filled button: it is a way *out* of this screen,
 * not the thing this screen is for, and the one filled shape on the hero has
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

function ActionCard({
  icon,
  label,
  caption,
  onPress,
}: {
  icon: string;
  label: string;
  caption: string;
  onPress: () => void;
}) {
  const press = usePress();

  return (
    <Animated.View style={[styles.actionShell, { transform: [{ scale: press.scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${caption}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.action}
      >
        <View style={styles.actionIcon}>
          <Ionicons name={icon as never} size={20} color={colors.action} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.actionCaption} numberOfLines={1}>
          {caption}
        </Text>
      </Pressable>
    </Animated.View>
  );
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
        <View style={[styles.shopAvatar, { backgroundColor: accent.surface }]}>
          <Text style={[styles.shopInitials, { color: accent.ink }]}>
            {shop.initials}
          </Text>
        </View>
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

function TrackerCard({
  order,
  onPress,
}: {
  order: OrderWithDetails;
  onPress: () => void;
}) {
  const shopName = order.shop?.name ?? 'Laundry shop';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shopName}, ${STATUS_LABELS[order.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.panel, styles.tracker, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.trackerHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shopName}
          </Text>
          <Text style={styles.trackerAmount}>
            {formatMoney(order.final_total ?? order.estimated_total)}
            {order.final_total === null ? ' estimated' : ''}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <WashCycleTracker status={order.status} />
    </Pressable>
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

const HERO_RADIUS = 28;

const styles = StyleSheet.create({
  // Escapes the page gutter on three sides so the colour reaches every edge.
  hero: {
    marginTop: -space.room,
    marginHorizontal: -space.room,
    marginBottom: space.snug,
    paddingHorizontal: space.section,
    paddingBottom: space.section,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: 'hidden',
    gap: space.snug,
    // The mid stop as a floor: if the gradient has not painted yet, or a
    // rounded corner antialiases past it, what shows through is still blue.
    backgroundColor: HERO_GRADIENT[1],
    ...elevation.hero,
  },
  heroBrandRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  heroWordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.onAccent,
  },
  // Subordinate to the wordmark but still the largest thing after it, and
  // bold enough at 21 to count as large text against the field.
  heroStatus: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 27,
    color: colors.onAccent,
    marginTop: space.cosy,
  },
  // A 34pt wordmark needs more air beneath it than the hero's default gap.
  heroDetail: {
    ...type.body,
    color: colors.onAccent,
    opacity: 0.92,
    marginTop: space.tight,
  },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    marginTop: space.cosy,
    paddingHorizontal: space.section,
    paddingVertical: space.cosy + 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    ...elevation.lift,
  },
  heroCtaText: { ...type.label, fontSize: 16, color: colors.actionInk },

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
    borderColor: HERO_GRADIENT[1],
  },
  // #3B2400 on #F5A623 is 8.4:1 — a 12px bold count has to survive sunlight.
  bellBadgeText: { fontSize: 11, fontWeight: '800', color: '#3B2400' },

  actionRow: { flexDirection: 'row', gap: space.cosy },
  // The shell carries the press transform; the card keeps the surface, so the
  // shadow scales with the card instead of detaching from it.
  actionShell: { flex: 1 },
  action: {
    gap: space.tight,
    padding: space.room,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.lift,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
    marginBottom: space.tight,
  },
  actionLabel: { ...type.label, fontSize: 16, color: colors.text },
  actionCaption: { ...type.caption, color: colors.subtle },

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
  // Surface and ink come from the shop's accent; these are the fallbacks.
  shopAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInitials: { ...type.label, fontSize: 15, color: colors.actionInk },
  shopName: { ...type.label, fontSize: 16, color: colors.text },
  shopAddress: { ...type.caption, color: colors.subtle },

  tracker: { gap: space.room },
  trackerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  trackerAmount: { ...type.caption, color: colors.subtle, marginTop: 2 },

  pastRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },

});
