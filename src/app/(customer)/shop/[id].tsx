import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaim } from '@/components/claim';
import { CycleStrip } from '@/components/cycle-strip';
import { useEntrance } from '@/components/entrance';
import { ReviewShowcase } from '@/components/review-showcase';
import { ShopMapCard } from '@/components/shop-map-card';
import { ServiceShelf } from '@/components/service-shelf';
import { ShopfrontHero } from '@/components/shopfront-hero';
import {
  ACCENTS,
  Card,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import {
  getMyOrders,
  getRegisteredShops,
  getServices,
  getShop,
  getShopReviews,
  joinShop,
} from '@/lib/api';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { storefrontTheme } from '@/lib/domain/web-theme';
import { shopLogoUri } from '@/lib/domain/shop-cover';
import { shopPin } from '@/lib/domain/shop-location';
import {
  claimHaptic,
  connectionRank,
  parseWelcomeParam,
  welcomeNote,
  type WelcomeNote,
} from '@/lib/domain/connection-welcome';
import { ENTRANCE } from '@/lib/domain/entrance';
import { shopInitials } from '@/lib/domain/connected-shops';
import { leadingIndex } from '@/lib/domain/home-headline';
import { TERMINAL_STATUSES } from '@/lib/domain/order-status';
import { groupServicesByCategory, labelledServices } from '@/lib/domain/service-catalog';
import { shopReputation, startingPrice } from '@/lib/domain/storefront';
import { useHaptic } from '@/lib/use-app-settings';
import type { ServiceRow } from '@/lib/types';

type Accent = (typeof ACCENTS)[number];

/**
 * What the shopfront says the moment a laundry becomes yours.
 *
 * Connecting used to be silent — the Connect card simply vanished and the
 * services quietly started working. It is the one action that turns a shop in a
 * directory into *your* shop, so it gets the app's own signal for that: the
 * laundry takes on its accent, the same tone it will wear on your home screen
 * from now on.
 *
 * The words come from `connection-welcome`, which is also what decides whether
 * this is the customer's *first* laundry. On that one it carries a badge and
 * says what the app has just become; on every later connection the badge is
 * gone and the second line spends itself on where this shop sits among the ones
 * already on the home screen — real information rather than a second round of
 * applause.
 *
 * It settles fully visible, so the motion is never required to read the card.
 */
function WelcomeCard({
  note,
  shopName,
  accent,
}: {
  note: WelcomeNote;
  shopName: string;
  accent: Accent;
}) {
  const isFirst = note.rank === 'first';
  // Lazy state, not a ref: the driver is read during render to build the
  // transform, and reading a ref there is a hook-rules violation.
  const [reveal] = useState(() => new Animated.Value(0));
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (alive) setIsReduced(reduced);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isReduced) {
      reveal.setValue(1);
      return;
    }
    Animated.timing(reveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isReduced, reveal]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        opacity: reveal,
        transform: [
          {
            translateY: reveal.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          {
            scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
          },
        ],
      }}
    >
      {/* A first laundry takes the shop's colour across the whole card; every
          later one keeps it to the hairline and the mark. The difference is
          weight, which is felt, rather than a label, which has to be read. */}
      <View
        style={[
          styles.welcome,
          { borderColor: accent.ink },
          isFirst && { backgroundColor: accent.surface, borderWidth: 2 },
        ]}
      >
        <View
          style={[
            styles.welcomeMark,
            { backgroundColor: isFirst ? colors.card : accent.surface },
          ]}
        >
          <Text style={[styles.welcomeInitials, { color: accent.ink }]}>
            {shopInitials(shopName)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeTitle, isFirst && styles.welcomeTitleFirst]}>
            {note.title}
          </Text>
          {/* Ink rather than the shared subtle grey when the card is tinted:
              grey secondary text on a coloured field is a white-card design
              pasted onto colour. */}
          <Text style={[styles.welcomeBody, isFirst && { color: colors.text }]}>
            {note.body}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}


export default function CustomerShopHome() {
  // `welcome` is the number of laundries the customer had *before* this one,
  // carried across the navigation when the connect happened in the directory.
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  const router = useRouter();
  const haptic = useHaptic();
  const insets = useSafeAreaInsets();
  // One driver for the whole arrival. Skipped entirely under Reduce Motion.
  const { progress } = useEntrance();
  const queryClient = useQueryClient();
  const [joinError, setJoinError] = useState('');

  const { data: shop, isLoading: isShopLoading, error: shopError } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => getShop(id!),
    enabled: Boolean(id),
  });

  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['services', id],
    queryFn: () => getServices(id!),
    enabled: Boolean(id),
  });

  const { data: reviews } = useQuery({
    queryKey: ['shop-reviews', id],
    queryFn: () => getShopReviews(id!),
    enabled: Boolean(id),
  });

  const { data: registered } = useQuery({
    queryKey: ['registered-shops'],
    queryFn: getRegisteredShops,
  });

  // Orders are only accepted from customers registered with the shop, so
  // booking stays behind a one-tap connect until then.
  const isRegistered = (registered ?? []).some((row) => row.id === id);

  /**
   * How many laundries the customer had before this one — set only for the
   * visit in which the connection happened, so returning to a shop you joined
   * last month does not re-congratulate you. `null` is the ordinary case.
   *
   * The initial value is the count a directory connect carried here, which is
   * why it is read once at mount rather than watched: re-reading the param
   * would replay the moment on every render Expo Router happens to repeat.
   */
  const [priorConnections, setPriorConnections] = useState<number | null>(() =>
    parseWelcomeParam(welcome)
  );
  const justConnected = priorConnections !== null;

  const joinMutation = useMutation({
    mutationFn: () => joinShop(id!),
    onSuccess: async () => {
      // Counted before the refetch, and without this shop, so the number is
      // "the laundries you already had" no matter which list it lands in.
      const prior = (registered ?? []).filter((row) => row.id !== id).length;
      await queryClient.invalidateQueries({ queryKey: ['registered-shops'] });
      setPriorConnections(prior);
    },
    onError: (err: Error) => setJoinError(err.message),
  });

  // The shop's own colour when it picked one, its stable hashed tone when it
  // has not — and the hashed tone while the row is still loading, so the
  // shopfront never flashes one colour before settling on another.
  const accent =
    ACCENTS[
      resolveAccent(
        { id: id ?? '', brand_accent: shop?.brand_accent ?? null },
        ACCENTS.length
      )
    ];

  // Same cache key the home screen uses, so this costs nothing extra.
  const { data: myOrders } = useQuery({ queryKey: ['my-orders'], queryFn: getMyOrders });

  /** This customer's loads still in the wash at *this* shop. */
  const activeHere = useMemo(
    () =>
      (myOrders ?? []).filter(
        (order) => order.shop?.id === id && !TERMINAL_STATUSES.includes(order.status)
      ),
    [myOrders, id]
  );

  // The same rule the home headline uses: ready outranks mid-cycle, then
  // whichever load is furthest along.
  const hereNow = useMemo(() => {
    const index = leadingIndex(activeHere);
    return index === -1 ? null : activeHere[index];
  }, [activeHere]);

  // One flat list in category order, each service carrying its own category —
  // the same ordering the shop's web page uses.
  const orderedServices = useMemo(
    () => labelledServices(groupServicesByCategory(services ?? [])),
    [services]
  );

  const reputation = useMemo(() => shopReputation(reviews ?? []), [reviews]);
  // The same accent the welcome card and the logo ring already wear, as the
  // tokens the map wash and the rating ladder paint with.
  const theme = useMemo(() => storefrontTheme(accent), [accent]);
  const cheapest = useMemo(() => startingPrice(services ?? []), [services]);

  const shopName = shop?.name ?? 'Laundry shop';

  const note = welcomeNote(shopName, priorConnections ?? -1);
  const rank = connectionRank(priorConnections ?? -1);
  /**
   * A connect made in the shops directory lands here while the shopfront is
   * still arriving, so the claim waits for the mark to finish landing — a mark
   * cannot be seen taking a colour while it is still dropping into place. A
   * connect made on this screen has nothing to wait for.
   */
  const claimDelay =
    parseWelcomeParam(welcome) === null ? 0 : ENTRANCE.mark.delay + ENTRANCE.mark.duration;
  const { claim } = useClaim(justConnected, claimDelay);

  // The tap lands with the colour, not with the network round trip that
  // preceded it, so the phone and the screen answer the finger together.
  useEffect(() => {
    if (!justConnected) return;
    const tap = setTimeout(() => haptic(claimHaptic(rank)), claimDelay);
    return () => clearTimeout(tap);
  }, [justConnected, rank, claimDelay, haptic]);

  const handleBook = (service: ServiceRow) => {
    if (!isRegistered) {
      setJoinError('Connect to this shop first to book a service.');
      return;
    }
    router.push(`/(customer)/book/${service.id}?shopId=${id}` as never);
  };

  if (isShopLoading || isServicesLoading) return <Loading />;

  return (
    <Screen>
      {/* The hero reaches the top of the display, so the clock and the
          battery have to be drawn in white to stay legible on it. */}
      <StatusBar style="light" />
      {shopError ? <ErrorText>{(shopError as Error).message}</ErrorText> : null}

      <ShopfrontHero
        name={shopName}
        tagline={shop?.tagline ?? ''}
        address={shop?.address ?? ''}
        logoUrl={shop ? shopLogoUri(shop) : null}
        coverUrl={shop?.cover_url ?? null}
        isRegistered={isRegistered}
        accent={accent}
        reputationLabel={reputation?.label ?? null}
        cheapest={cheapest}
        serviceCount={services?.length ?? 0}
        insetTop={insets.top}
        progress={progress}
        claim={claim}
        isClaiming={justConnected}
        rank={rank}
        onBack={() => (router.canGoBack() ? router.back() : router.push('/(customer)/shops' as never))}
        isConnecting={joinMutation.isPending}
        onConnect={() => {
          setJoinError('');
          joinMutation.mutate();
        }}
      />

      <ErrorText>{joinError}</ErrorText>

      {justConnected && <WelcomeCard note={note} shopName={shopName} accent={accent} />}

      {/* Where your laundry is, at the shop that has it. A load belongs to one
          laundry, so this is the screen that can answer for it, and on a shop
          you are actually using it is the first thing worth reading — so it
          sits above the price list rather than inside it. "Where is my
          laundry" is a different question from "what does a load cost", and a
          heading between them is what says so.
          Shown for any shop you have connected to, resting when nothing of
          yours is in its machines. It used to appear only mid-cycle, which
          meant the place you go to ask "where is my laundry" answered by
          showing nothing — indistinguishable from having no tracker at all.
          A shop you have never joined still shows none: that one would be
          noise. */}
      {isRegistered && (
        <CycleStrip
          status={hereNow?.status ?? null}
          accent={accent}
          extraCount={Math.max(activeHere.length - 1, 0)}
          onPress={
            hereNow
              ? () => router.push(`/(customer)/order/${hereNow.id}` as never)
              : undefined
          }
        />
      )}

      {/* The shelf: every service the owner listed, in the order the owner
          grouped them, searchable once there are enough of them to hunt
          through. It reads as a menu — a heading per category, a row per
          service, the price on the right where a column of them compares.

          The shelf owns its own cascade, so it takes the page's list cue as a
          delay rather than a driver: the cards land behind the hero, and land
          again whenever a search re-forms the grid. */}
      <ServiceShelf
        entries={orderedServices}
        isDisabled={!isRegistered}
        onBook={handleBook}
        delay={ENTRANCE.list.delay}
      />

      {/* Where the shop is, before what people said about it: a customer
          deciding whether to come needs the corner more than the score. */}
      {shop ? (
        <>
          <Text style={styles.sectionTitle}>Where to Find Us</Text>
          <ShopMapCard
            name={shopName}
            address={shop.address ?? ''}
            pin={shopPin(shop)}
            theme={theme}
          />
        </>
      ) : null}

      {/* Live reviews feed — rendered inline, not hidden behind a button. */}
      <Text style={styles.sectionTitle}>What Customers Say</Text>
      {reviews?.length ? (
        <ReviewShowcase
          reviews={reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            reviewerName: review.reviewer?.full_name ?? null,
          }))}
          reputation={reputation}
          theme={theme}
          showNames
        />
      ) : (
        <Card>
          <Subtle>
            No reviews yet. Reviews from customers will show up here after their
            orders are completed.
          </Subtle>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  welcomeMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeInitials: { ...type.label, fontSize: 16 },
  welcomeTitle: { ...type.section, color: colors.text, marginBottom: 2 },
  /** The one connection that changes what the app is for gets the larger voice. */
  welcomeTitleFirst: { ...type.title, fontSize: 20, marginBottom: space.tight },
  welcomeBody: { ...type.body, color: colors.subtle },

  sectionTitle: { ...type.title, color: colors.text, marginTop: space.cosy },


});
