/**
 * Booking from a shop's web page: https://<host>/s/<slug>/book.
 *
 * The same booking as the app — the same steps, add-ons, heavy items, wash
 * preferences and review — because it is the same component,
 * `components/booking-flow`. This page only supplies what the web knows that
 * the app does not: the shop's brand band and shell, a service picker for a
 * visitor who came in through "Book online" rather than a price card, and a
 * guest sign-in on the review, where a name and a number make an account and
 * the order is placed in the same tap. Someone already signed in books as
 * themselves.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookingFlow, type BookingFrameProps } from '@/components/booking-flow';
import { ACCENTS, Loading, colors, space, type } from '@/components/ui-kit';
import { GuestForm } from '@/components/web/guest-form';
import { PriceList } from '@/components/web/price-list';
import { PageBand, WebShell, useWebLayout } from '@/components/web/web-shell';
import { getMyLaundryPreferences, getStorefront, registerWithShopBySlug } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { seedBooking, type BookingStep } from '@/lib/domain/booking-seed';
import { NO_PREFERENCES, supportedPreferenceKeys } from '@/lib/domain/laundry-preferences';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { pickedServiceId, storefrontServiceRows } from '@/lib/domain/storefront-booking';
import { storefrontTheme, type StorefrontTheme } from '@/lib/domain/web-theme';
import type { Storefront } from '@/lib/types';

const STEP_TITLES: Record<BookingStep, string> = {
  items: 'What are we washing?',
  schedule: 'When and where?',
  review: 'Check and book',
};

export default function BookPage() {
  const { slug, service } = useLocalSearchParams<{ slug: string; service?: string | string[] }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => getStorefront(slug!),
    enabled: Boolean(slug),
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <WebShell>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {error ? 'We could not load this page' : 'This laundry is not online'}
          </Text>
        </View>
      </WebShell>
    );
  }
  return <BookingPage storefront={data} slug={slug!} serviceId={pickedServiceId(service)} />;
}

/** What the web frame needs and the shared flow does not carry. */
interface WebFrameContext {
  theme: StorefrontTheme;
  shopName: string;
  onBackToShop: () => void;
  /** Who is booking, when someone is signed in; null for a guest. */
  signedInAs: string | null;
  onSignOut: () => void;
}

const FrameContext = createContext<WebFrameContext | null>(null);

/**
 * The shop's shell around the shared steps. Declared once at module level so
 * the flow keeps one frame across renders; what varies comes from context.
 */
function WebFrame({ step, footer, children }: BookingFrameProps) {
  const frame = useContext(FrameContext);
  const layout = useWebLayout();
  if (!frame) return null;
  return (
    <WebShell
      footer={footer}
      hero={
        <PageBand
          backLabel={frame.shopName}
          onBack={frame.onBackToShop}
          title={STEP_TITLES[step]}
          theme={frame.theme}
        />
      }
    >
      <View style={[styles.body, { padding: layout.gutter }]}>
        {children}
        {step === 'review' && frame.signedInAs !== null ? (
          <View style={styles.who}>
            <Text style={styles.whoText}>Booking as {frame.signedInAs}</Text>
            <Pressable accessibilityRole="button" onPress={frame.onSignOut}>
              <Text style={[styles.whoLink, { color: frame.theme.brandInk }]}>
                Not you? Use another number
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </WebShell>
  );
}

interface BookingPageProps {
  storefront: Storefront;
  slug: string;
  /** The service a price card was tapped on; null for "Book online". */
  serviceId: string | null;
}

function BookingPage({ storefront, slug, serviceId }: BookingPageProps) {
  const { shop } = storefront;
  const router = useRouter();
  const layout = useWebLayout();
  const { session, profile, signOut } = useAuth();
  /**
   * Whether to hold the flow for the usual wash: only for someone signed in
   * when the page opened. A guest who signs in on the review must not see the
   * flow swap for a spinner — that would throw their booking away mid-tap.
   */
  const [waitsForUsual] = useState(() => Boolean(session));
  const theme = storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
  const services = storefrontServiceRows(shop.id, storefront.services);
  const service = serviceId ? services.find((row) => row.id === serviceId) : undefined;

  // The customer's usual wash, once there is a customer. A guest starts blank;
  // a failure only costs the prefill.
  const usual = useQuery({
    queryKey: ['my-laundry-preferences'],
    queryFn: getMyLaundryPreferences,
    enabled: Boolean(session),
    retry: false,
  });

  const frame: WebFrameContext = {
    theme,
    shopName: shop.name,
    onBackToShop: () => router.push(`/s/${slug}` as never),
    signedInAs: session ? profile?.full_name || 'you' : null,
    // Signing out only swaps who is booking; the answers so far stay put.
    onSignOut: () => void signOut().catch(() => undefined),
  };

  // No service yet: the same shelf the shop page and the app draw, one tap
  // from the booking. A stale link to a service the shop has since removed
  // lands here too, rather than on an error.
  if (!service) {
    return (
      <>
        <Head>
          <title>{`Book with ${shop.name}`}</title>
        </Head>
        <WebShell
          hero={
            <PageBand
              backLabel={shop.name}
              onBack={frame.onBackToShop}
              title="What would you like washed?"
              theme={theme}
            />
          }
        >
          <View style={[styles.body, { padding: layout.gutter }]}>
            <PriceList
              services={storefront.services}
              theme={theme}
              columns={layout.priceColumns}
              onBook={(id) => router.setParams({ service: id })}
            />
          </View>
        </WebShell>
      </>
    );
  }

  if (waitsForUsual && usual.isLoading) return <Loading />;

  const supported = supportedPreferenceKeys(shop.supported_preferences);
  const seed = seedBooking({
    draft: null,
    droppedNames: [],
    previousPickupAt: null,
    usual: usual.data ?? NO_PREFERENCES,
    supported,
    service,
    services,
    now: new Date(),
  });

  return (
    <FrameContext.Provider value={frame}>
      <Head>
        <title>{`Book ${service.name} with ${shop.name}`}</title>
      </Head>
      <BookingFlow
        // One flow per service, seeded once at mount so nothing races it.
        key={service.id}
        shopId={shop.id}
        service={service}
        services={services}
        supported={supported}
        seed={seed}
        shopAddons={storefront.addons ?? []}
        addonRules={storefront.addon_groups ?? {}}
        Frame={WebFrame}
        // Connects the visitor to the shop — a no-op for someone already
        // connected — and answers the shop to book with.
        prepare={() => registerWithShopBySlug(slug)}
        // Always an online booking, even when the person tapping is the owner:
        // this is the shop's public page, not its counter.
        orderType="online"
        // The slip first, then tracking.
        onPlaced={(order) => router.replace(`/placed/${order.id}` as never)}
        onCheckOrders={() => router.push(`/s/${slug}/orders` as never)}
        renderSignIn={(place) => (
          <GuestForm submitLabel="Place order" busyLabel="Placing…" onSignedIn={place} theme={theme} />
        )}
      />
    </FrameContext.Provider>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.section },
  who: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug, alignItems: 'baseline' },
  whoText: { ...type.caption, color: colors.subtle },
  whoLink: { ...type.label },
  notice: { padding: space.gulf, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
});
