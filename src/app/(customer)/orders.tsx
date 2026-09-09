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
import { WasherMark } from '@/components/washer-mark';
import {
  ACCENTS,
  Button,
  EmptyState,
  ErrorText,
  HERO_GRADIENT,
  Loading,
  STATUS_COLORS,
  STATUS_LABELS,
  Screen,
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
import { docketNumber } from '@/lib/domain/docket';
import { assignBrandAccents, resolveAccent } from '@/lib/domain/shop-branding';
import { cycleStanding, washCycleProgress } from '@/lib/domain/wash-cycle';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import {
  connectedShopTiles,
  type ConnectedShopTile,
} from '@/lib/domain/connected-shops';
import {
  homeAttention,
  type AttentionCard,
} from '@/lib/domain/home-attention';
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

      {/* The ping: what is owed, straight under the hero, before anything the
          customer might browse to. A bill is the one thing on this screen the
          shop is waiting on. */}
      {attention.map((card) => (
        <AttentionBanner
          key={`${card.orderId}:${card.kind}`}
          card={card}
          onPress={() => go(`/(customer)/order/${card.orderId}`)}
        />
      ))}

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

/**
 * One load in the wash, as a ticket stub.
 *
 * This was three full wash-cycle trackers stacked down the home screen: five
 * dots, five labels, a bar and a sentence, repeated per order at roughly 250px
 * each. With three loads from the same laundry the cards were literally
 * indistinguishable — same name, same badge, same five grey dots, same
 * sentence — so the section answered "how many loads do I have" and nothing
 * else. The roadmap of five stages belongs on the order screen, which is opened
 * to study one load; a list is opened to *find* one.
 *
 * So each row keeps only what tells loads apart, in the order they are asked
 * for: which laundry, which load, where it is, what it costs. The full tracker
 * is one tap away and unchanged.
 *
 * It reads as the stub of that ticket — the laundry's colour down the spine
 * where the ticket wears it as a band, and the same docket number in the same
 * monospace — so tapping one opens something recognisably larger rather than
 * something else.
 */
function TrackerCard({
  order,
  onPress,
}: {
  order: OrderWithDetails;
  onPress: () => void;
}) {
  const shopName = order.shop?.name ?? 'Laundry shop';
  const accent =
    ACCENTS[
      resolveAccent(
        { id: order.shop?.id ?? order.shop_id, brand_accent: order.shop?.brand_accent ?? null },
        ACCENTS.length
      )
    ];
  const progress = washCycleProgress(order.status);
  const standing = cycleStanding(order.status);
  const stageColor = STATUS_COLORS[order.status];
  const docket = docketNumber(order.id);

  return (
    <Pressable
      accessibilityRole="button"
      // The spoken label carries the position too: the bar and the spine are
      // sighted shorthand, and a screen reader gets the whole sentence.
      accessibilityLabel={`${shopName}, ${STATUS_LABELS[order.status]}, ${
        standing.caption
      }, ${formatMoney(order.final_total ?? order.estimated_total)}${
        order.final_total === null ? ' estimated' : ''
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.stub, pressed && { opacity: 0.85 }]}
    >
      {/* The stub's end block, in the laundry's own tone — the ticket's band,
          stood on its end. A 6px spine was the same idea whispered: it read as
          a rule left on a list row, not as a piece of the ticket.
          The drum inside it is the app's own mark, and it *turns only while the
          load is genuinely in a machine* — so on a screen of three loads, the
          one actually being washed is the one that moves. Nothing else in the
          list moves at all, which is what makes it worth noticing. */}
      <View style={[styles.stubBlock, { backgroundColor: accent.ink }]}>
        <WasherMark size={30} isRunning={standing.isRunning} />
      </View>

      {/* The punch and the dashed seam: where a real stub is torn from its
          ticket. The circles are page-coloured and clipped by the card, so the
          bite is a clip rather than a shape kept in sync with the height. */}
      <View style={[styles.stubNotch, styles.stubNotchTop]} />
      <View style={[styles.stubNotch, styles.stubNotchBottom]} />
      <View style={styles.stubSeam} />

      <View style={styles.stubBody}>
        <View style={styles.stubHead}>
          <Text style={styles.stubShop} numberOfLines={1}>
            {shopName}
          </Text>
          {docket ? <Text style={styles.stubDocket}>NO. {docket}</Text> : null}
        </View>

        {/* The cycle as one line rather than five. The bar carries the same
            status hue the order screen's tracker uses, so the two agree. */}
        <View style={styles.stubTrack}>
          <View
            style={[
              styles.stubFill,
              { width: `${progress.percent}%`, backgroundColor: stageColor },
            ]}
          />
        </View>

        <View style={styles.stubFoot}>
          <Text style={[styles.stubStage, { color: stageColor }]} numberOfLines={1}>
            {STATUS_LABELS[order.status]}
          </Text>
          {/* Only once the cycle has begun: before that the caption reads "Not
              started yet", which the stage word beside it has already said. */}
          {standing.position > 0 ? (
            <Text style={styles.stubStep}>{standing.caption}</Text>
          ) : null}
          <Text style={styles.stubAmount}>
            {formatMoney(order.final_total ?? order.estimated_total)}
            {order.final_total === null ? ' est.' : ''}
          </Text>
        </View>
      </View>
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
