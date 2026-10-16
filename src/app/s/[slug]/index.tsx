/**
 * A laundry's own web page: https://<host>/s/<slug>.
 *
 * Read by anyone, signed in or not. Nothing on it depends on the app's
 * session, splash gate, or tab bar; it is the shop as a customer walking
 * past would see it, with the price list open and the phone number one tap
 * away. Booking hangs off it: "Book online" leads to /s/<slug>/book.
 *
 * It takes whatever window it is opened in. On a phone that is one column
 * under a full-bleed hero; on a laptop the price grid widens and the shop's
 * address and code stand in a column of their own beside it, with the booking
 * buttons at the top of that column rather than across the foot of the screen.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { MarketBasketBar } from '@/components/market-basket-bar';
import { MarketCatalog, MarketHeader } from '@/components/market-storefront';
import { SpotlightBasket } from '@/components/spotlight-basket';
import { SpotlightBody, SpotlightHeader, useSpotlight } from '@/components/spotlight-storefront';
import { ACCENTS, Loading, colors, fontFor, space, type } from '@/components/ui-kit';
import { OrderStatusBand } from '@/components/web/order-status-band';
import { ShopPriceGuide, hasPriceGuide } from '@/components/price-guide';
import { ShopRewardsCard } from '@/components/shop-rewards-card';
import { PriceList } from '@/components/web/price-list';
import { ReviewList } from '@/components/web/review-list';
import { ShopDetails, mapsLink } from '@/components/web/shop-details';
import { StorefrontHero } from '@/components/web/storefront-hero';
import { WebShell, useWebLayout } from '@/components/web/web-shell';
import { getMyOrders, getShopServiceImages, getShopStorefrontStyle, getStorefront } from '@/lib/api';
import { withServiceImages } from '@/lib/domain/spotlight';
import { useAuth } from '@/lib/auth';
import { storefrontGreeting } from '@/lib/domain/home-greeting';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { shopReputation, startingPrice } from '@/lib/domain/storefront';
import { orderOnShow } from '@/lib/domain/storefront-order';
import { storefrontTheme } from '@/lib/domain/web-theme';
import { storefrontServiceRows } from '@/lib/domain/storefront-booking';
import { useMarketCart } from '@/lib/use-market-cart';
import type { Storefront } from '@/lib/types';

export default function StorefrontPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => getStorefront(slug!),
    enabled: Boolean(slug),
  });

  if (isLoading) return <Loading />;
  if (error) return <Notice title="We could not load this page" body="Check your connection and try again." />;
  if (!data) {
    return (
      <Notice
        title="This laundry is not online"
        body="The link may be old, or the shop has switched its web page off. Ask them for a fresh one."
      />
    );
  }

  return <StorefrontBody storefront={data} />;
}

/**
 * Which look the shop chose. Read on its own, so a page that cannot read it
 * still opens — as the classic page — rather than failing.
 */
function StorefrontBody({ storefront }: { storefront: Storefront }) {
  const style = useQuery({
    queryKey: ['storefront-style', storefront.shop.id],
    queryFn: () => getShopStorefrontStyle(storefront.shop.id),
    retry: false,
  });
  if (style.isLoading) return <Loading />;
  if (style.data === 'spotlight') return <SpotlightPage storefront={storefront} />;
  return style.data === 'market' ? (
    <MarketBody storefront={storefront} />
  ) : (
    <ClassicBody storefront={storefront} />
  );
}

/** The market look: a store header, the product grid, and a basket bar. */
function MarketBody({ storefront }: { storefront: Storefront }) {
  const { shop, reviews } = storefront;
  const router = useRouter();
  // The basket, when the checkout's Edit brought the customer back here.
  const { cart } = useLocalSearchParams<{ cart?: string }>();
  const { session } = useAuth();
  const layout = useWebLayout();
  const services = storefrontServiceRows(shop.id, storefront.services);
  const basket = useMarketCart(services, cart);
  const myOrders = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
    enabled: Boolean(session),
  });
  const tracked = orderOnShow(myOrders.data ?? [], shop.id);
  const accent = ACCENTS[resolveAccent(shop, ACCENTS.length)];
  const theme = storefrontTheme(accent);
  const reputation = shopReputation(reviews);
  const phone = shop.phone.trim();

  const trackBand = (
    <OrderStatusBand
      theme={theme}
      order={tracked}
      isLoading={Boolean(session) && myOrders.isLoading}
      isSignedIn={Boolean(session)}
      onOpen={() => router.push(`/s/${shop.slug}/orders` as never)}
    />
  );

  const checkout = () => {
    if (!basket.booking) return;
    router.push({
      pathname: `/s/${shop.slug}/book`,
      params: { service: basket.booking.serviceId, cart: basket.encoded },
    } as never);
  };

  const footer =
    basket.count > 0 ? (
      <MarketBasketBar
        count={basket.count}
        estimate={basket.estimate}
        isFromPrice={basket.isFromPrice}
        accent={accent}
        onCheckout={checkout}
      />
    ) : phone ? (
      <ActionButton
        title="Call the shop"
        onPress={() => Linking.openURL(`tel:${phone}`)}
        fill={theme.brandSoft}
        ink={theme.brandInk}
      />
    ) : null;

  return (
    <>
      <Head>
        <title>{shop.name}</title>
        <meta name="description" content={shop.tagline || `Book laundry online with ${shop.name}.`} />
      </Head>
      <WebShell
        footer={footer}
        hero={
          <MarketHeader
            name={shop.name}
            tagline={shop.tagline}
            logoUrl={shop.logo_url || null}
            accent={accent}
            reputation={reputation}
            sign={null}
            cheapest={startingPrice(storefront.services)}
            coverUrl={shop.cover_url || null}
            isInset
          />
        }
        aside={
          <View
            style={[
              styles.aside,
              { paddingTop: layout.gutter, paddingHorizontal: layout.hasAside ? 0 : layout.gutter },
            ]}
          >
            <Text style={styles.sectionTitle}>Store info</Text>
            <ShopDetails shop={shop} theme={theme} />
          </View>
        }
      >
        <View style={[styles.body, { padding: layout.gutter }]}>
          {tracked ? trackBand : null}
          <MarketCatalog
            services={services}
            cart={basket.cart}
            accent={accent}
            onAdd={basket.add}
            onRemove={basket.remove}
            notice={basket.notice}
          />
          <ShopRewardsCard shopId={shop.id} isRegistered={false} />
          <ShopPriceGuide shopId={shop.id} services={services} />
          {tracked ? null : trackBand}
          {reputation && reviews.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Ratings</Text>
              <ReviewList reviews={reviews} reputation={reputation} theme={theme} />
            </>
          ) : null}
        </View>
      </WebShell>
    </>
  );
}

/** The spotlight look: a greeting header, deal cards, product cards on a grid, the market's basket. */
function SpotlightPage({ storefront }: { storefront: Storefront }) {
  const { shop, reviews } = storefront;
  const router = useRouter();
  const { cart } = useLocalSearchParams<{ cart?: string }>();
  const { session, profile } = useAuth();
  const layout = useWebLayout();
  // The shop's own service photos, read on their own: a failure only costs
  // them, and every card falls back to the app's cut-out.
  const images = useQuery({
    queryKey: ['service-images', shop.id],
    queryFn: () => getShopServiceImages(shop.id),
    retry: false,
  });
  const services = useMemo(
    () => withServiceImages(storefrontServiceRows(shop.id, storefront.services), images.data),
    [shop.id, storefront.services, images.data]
  );
  const basket = useMarketCart(services, cart);
  const reputation = useMemo(() => shopReputation(reviews), [reviews]);
  const spot = useSpotlight({ services, reputation });
  const [isBasketOpen, setBasketOpen] = useState(false);
  // Emptied from inside, the basket closes for good, so the next "+" stays on the grid.
  if (isBasketOpen && basket.count === 0) setBasketOpen(false);
  const myOrders = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
    enabled: Boolean(session),
  });
  const tracked = orderOnShow(myOrders.data ?? [], shop.id);
  const accent = ACCENTS[resolveAccent(shop, ACCENTS.length)];
  const theme = storefrontTheme(accent);
  const phone = shop.phone.trim();

  const checkout = () => {
    if (!basket.booking) return;
    router.push({
      pathname: `/s/${shop.slug}/book`,
      params: { service: basket.booking.serviceId, cart: basket.encoded },
    } as never);
  };

  const footer =
    basket.count > 0 ? (
      <MarketBasketBar
        count={basket.count}
        estimate={basket.estimate}
        isFromPrice={basket.isFromPrice}
        accent={accent}
        onCheckout={() => setBasketOpen(true)}
      />
    ) : phone ? (
      <ActionButton
        title="Call the shop"
        onPress={() => Linking.openURL(`tel:${phone}`)}
        fill={theme.brandSoft}
        ink={theme.brandInk}
      />
    ) : null;

  return (
    <>
      <Head>
        <title>{shop.name}</title>
        <meta name="description" content={shop.tagline || `Book laundry online with ${shop.name}.`} />
      </Head>
      <WebShell
        footer={footer}
        // "View basket" stays across the foot at every width, under the "+".
        isFooterPinned={basket.count > 0}
        hero={
          <SpotlightHeader
            name={shop.name}
            logoUrl={shop.logo_url || null}
            accent={accent}
            reputation={reputation}
            sign={null}
            cheapest={startingPrice(storefront.services)}
            customerName={profile?.full_name}
            basketCount={basket.count}
            onBasket={basket.count > 0 ? () => setBasketOpen(true) : undefined}
            query={spot.query}
            onQuery={spot.setQuery}
            isInset
            contentWidth={layout.contentWidth}
          />
        }
        aside={
          <View
            style={[
              styles.aside,
              { paddingTop: layout.gutter, paddingHorizontal: layout.hasAside ? 0 : layout.gutter },
            ]}
          >
            <Text style={styles.sectionTitle}>Store info</Text>
            <ShopDetails shop={shop} theme={theme} />
          </View>
        }
      >
        <View style={[styles.body, { padding: layout.gutter }]}>
          <SpotlightBody
            spot={spot}
            accent={accent}
            cart={basket.cart}
            onAdd={basket.add}
            onRemove={basket.remove}
            notice={basket.notice}
          >
            <OrderStatusBand
              theme={theme}
              order={tracked}
              isLoading={Boolean(session) && myOrders.isLoading}
              isSignedIn={Boolean(session)}
              onOpen={() => router.push(`/s/${shop.slug}/orders` as never)}
            />
          </SpotlightBody>
          <ShopRewardsCard shopId={shop.id} isRegistered={false} />
          <ShopPriceGuide shopId={shop.id} services={services} />
          {reputation && reviews.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Ratings</Text>
              <ReviewList reviews={reviews} reputation={reputation} theme={theme} />
            </>
          ) : null}
        </View>
      </WebShell>
      <SpotlightBasket
        isOpen={isBasketOpen}
        lines={basket.lines}
        frames={spot.frames}
        accent={accent}
        shopName={shop.name}
        reputation={reputation}
        total={basket.estimate}
        isFromPrice={basket.isFromPrice}
        onAdd={basket.add}
        onRemove={basket.remove}
        onCheckout={() => {
          setBasketOpen(false);
          checkout();
        }}
        onClose={() => setBasketOpen(false)}
      />
    </>
  );
}

function ClassicBody({ storefront }: { storefront: Storefront }) {
  const { shop, services, reviews } = storefront;
  const router = useRouter();
  const { session, profile } = useAuth();
  const layout = useWebLayout();
  // Only asked for when there is a session to ask about. A signed-out visitor
  // gets the band in its empty state, which leads to the page that finds an
  // order from the name and number it was booked with.
  const myOrders = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
    enabled: Boolean(session),
  });
  const tracked = orderOnShow(myOrders.data ?? [], shop.id);
  const canBook = services.length > 0;
  const theme = storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
  const reputation = shopReputation(reviews);
  const cheapest = startingPrice(services);
  const phone = shop.phone.trim();
  const maps = mapsLink(shop);
  const description = shop.tagline || `Prices and contact details for ${shop.name}.`;

  // Booking leads when there is a price list to book from; the phone is the
  // fallback for a shop that has not posted prices yet. Side by side in the
  // foot bar of a narrow window; stacked in the side column, where there is
  // height to spare and two half-width buttons would read as a squeeze.
  const footer =
    canBook || phone || maps ? (
      <View style={[styles.actions, layout.hasAside && styles.actionsStacked]}>
        {canBook ? (
          <ActionButton
            title="Book online"
            onPress={() => router.push(`/s/${shop.slug}/book` as never)}
            fill={theme.brand}
            ink={theme.onBrand}
          />
        ) : null}
        {phone ? (
          <ActionButton
            title={canBook ? 'Call' : 'Call to book'}
            onPress={() => Linking.openURL(`tel:${phone}`)}
            fill={canBook ? theme.brandSoft : theme.brand}
            ink={canBook ? theme.brandInk : theme.onBrand}
          />
        ) : null}
        {maps && !canBook ? (
          <ActionButton
            title="Directions"
            onPress={() => Linking.openURL(maps)}
            fill={theme.brandSoft}
            ink={theme.brandInk}
          />
        ) : null}
      </View>
    ) : null;

  return (
    <>
      <Head>
        <title>{shop.name}</title>
        <meta name="description" content={description} />
      </Head>
      <WebShell
        footer={footer}
        hero={
          <StorefrontHero
            shop={shop}
            theme={theme}
            reputationLabel={reputation?.label ?? null}
            cheapest={cheapest}
            serviceCount={services.length}
            greeting={storefrontGreeting(profile?.full_name)}
            layout={layout}
          />
        }
        aside={
          <View
            style={[
              styles.aside,
              { paddingTop: layout.gutter, paddingHorizontal: layout.hasAside ? 0 : layout.gutter },
            ]}
          >
            <Text style={styles.sectionTitle}>Find the shop</Text>
            <ShopDetails shop={shop} theme={theme} />
          </View>
        }
      >
        <View style={[styles.body, { padding: layout.gutter }]}>
          {/* Above the price list, because a customer who has already ordered
              is not back to read prices — they are back to find out whether
              the wash is done. */}
          <OrderStatusBand
            theme={theme}
            order={tracked}
            isLoading={Boolean(session) && myOrders.isLoading}
            isSignedIn={Boolean(session)}
            onOpen={() => router.push(`/s/${shop.slug}/orders` as never)}
          />
          {/* The shelf carries its own heading, because on a shop with enough
              services it also carries the search under it — a page heading
              above that would be a second title for one region. */}
          <ShopRewardsCard shopId={shop.id} isRegistered={false} />
          {hasPriceGuide(shop.id) ? (
            <ShopPriceGuide
              shopId={shop.id}
              services={services}
              onBook={
                canBook
                  ? (service) =>
                      router.push({ pathname: `/s/${shop.slug}/book`, params: { service: service.id } } as never)
                  : undefined
              }
            />
          ) : (
            <PriceList
              services={services}
              theme={theme}
              columns={layout.priceColumns}
              onBook={
                canBook
                  ? (serviceId) =>
                      router.push({ pathname: `/s/${shop.slug}/book`, params: { service: serviceId } } as never)
                  : undefined
              }
            />
          )}
          {reputation && reviews.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>What customers say</Text>
              <ReviewList reviews={reviews} reputation={reputation} theme={theme} />
            </>
          ) : null}
        </View>
      </WebShell>
    </>
  );
}

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  fill: string;
  ink: string;
}

function ActionButton({ title, onPress, fill, ink }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: fill }, pressed && styles.pressed]}
    >
      <Text style={[styles.actionTitle, { color: ink }]}>{title}</Text>
    </Pressable>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <WebShell>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.cosy },
  aside: { gap: space.cosy },
  // Ink on the page field, not white: the hero already spent the white on
  // navy, and these headings sit on `colors.bg`.
  sectionTitle: { ...type.section, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: colors.text, marginTop: space.gulf },
  actions: { flexDirection: 'row', gap: space.cosy },
  /** In the side column the buttons run full width, one under the other. */
  actionsStacked: { flexDirection: 'column' },
  action: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.room,
  },
  actionTitle: { ...type.body, fontSize: 17, letterSpacing: -0.3, ...fontFor(600) },
  pressed: { opacity: 0.8 },
  notice: { padding: space.gulf, gap: space.snug, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  noticeBody: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
