/**
 * A laundry's own web page: https://<host>/s/<slug>.
 *
 * Read by anyone, signed in or not. Nothing on it depends on the app's
 * session, splash gate, or tab bar; it is the shop as a customer walking
 * past would see it, with the price list open and the phone number one tap
 * away. Booking hangs off it: "Book online" leads to /s/<slug>/book.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, Loading, colors, space, type } from '@/components/ui-kit';
import { PriceList } from '@/components/web/price-list';
import { ReviewList } from '@/components/web/review-list';
import { ShopDetails, mapsLink } from '@/components/web/shop-details';
import { StorefrontHero } from '@/components/web/storefront-hero';
import { WebShell } from '@/components/web/web-shell';
import { getStorefront } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { shopReputation, startingPrice } from '@/lib/domain/storefront';
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
  const { session } = useAuth();
  const canBook = services.length > 0;
  const theme = storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
  const reputation = shopReputation(reviews);
  const cheapest = startingPrice(services);
  const phone = shop.phone.trim();
  const maps = mapsLink(shop);
  const description = shop.tagline || `Prices and contact details for ${shop.name}.`;

  // Booking leads when there is a price list to book from; the phone is the
  // fallback for a shop that has not posted prices yet.
  const footer =
    canBook || phone || maps ? (
      <View style={styles.actions}>
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
      <WebShell footer={footer}>
        <StorefrontHero
          shop={shop}
          theme={theme}
          reputationLabel={reputation?.label ?? null}
          cheapest={cheapest}
          serviceCount={services.length}
        />
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Prices</Text>
          <PriceList
            services={services}
            theme={theme}
            onBook={
              canBook
                ? (serviceId) =>
                    router.push({ pathname: `/s/${shop.slug}/book`, params: { service: serviceId } } as never)
                : undefined
            }
          />
          {/* Below the prices on purpose. This link only exists for a customer
              who has ordered here before, and putting it first made the page
              open on a piece of navigation rather than on what the shop
              sells. */}
          {session ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/s/${shop.slug}/orders` as never)}
              style={[styles.ordersLink, { backgroundColor: theme.brandSoft }]}
            >
              <Text style={[styles.ordersLinkText, { color: theme.brandInk }]}>Your orders here ›</Text>
            </Pressable>
          ) : null}
          {reputation && reviews.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>What customers say</Text>
              <ReviewList reviews={reviews} reputation={reputation} theme={theme} />
            </>
          ) : null}
          <Text style={styles.sectionTitle}>Find the shop</Text>
          <ShopDetails shop={shop} theme={theme} />
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
  body: { padding: space.room, gap: space.cosy },
  sectionTitle: { ...type.section, color: colors.text, marginTop: space.cosy },
  ordersLink: { borderRadius: 12, padding: space.cosy, alignItems: 'center' },
  ordersLinkText: { ...type.label },
  actions: { flexDirection: 'row', gap: space.cosy },
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
