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
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, Loading, colors, space, type } from '@/components/ui-kit';
import { OrderStatusBand } from '@/components/web/order-status-band';
import { PriceList } from '@/components/web/price-list';
import { ReviewList } from '@/components/web/review-list';
import { ShopDetails, mapsLink } from '@/components/web/shop-details';
import { StorefrontHero } from '@/components/web/storefront-hero';
import { WebShell, useWebLayout } from '@/components/web/web-shell';
import { getMyOrders, getStorefront } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { storefrontGreeting } from '@/lib/domain/home-greeting';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { shopReputation, startingPrice } from '@/lib/domain/storefront';
import { orderOnShow } from '@/lib/domain/storefront-order';
import { storefrontTheme } from '@/lib/domain/web-theme';
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

function StorefrontBody({ storefront }: { storefront: Storefront }) {
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
        isField
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
          <Text style={styles.sectionTitle}>Services</Text>
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
  // On the field itself rather than on a sheet, so this is the page's only
  // white ink — the same move the app's shop screen makes.
  sectionTitle: { ...type.section, color: colors.onAccent, marginTop: space.cosy },
  actions: { flexDirection: 'row', gap: space.cosy },
  /** In the side column the buttons run full width, one under the other. */
  actionsStacked: { flexDirection: 'column' },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.room,
  },
  actionTitle: { ...type.label, fontSize: 16 },
  pressed: { opacity: 0.8 },
  notice: { padding: space.gulf, gap: space.snug, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  noticeBody: { ...type.body, color: colors.subtle, textAlign: 'center' },
});
