/**
 * The signed-in visitor's orders at this shop: https://<host>/s/<slug>/orders.
 *
 * A guest who closed the tab has only the shop's page to come back to. This
 * lists what they have booked here and leads to each order's tracking page.
 */
import { useQuery } from "@tanstack/react-query";
import Head from "expo-router/head";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { OrderStub } from "@/components/order-stub";
import { ACCENTS, Loading, colors, space, type } from "@/components/ui-kit";
import { GuestForm } from "@/components/web/guest-form";
import { PageBand, WebShell, useWebLayout } from "@/components/web/web-shell";
import { getMyOrders, getStorefront } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { resolveAccent } from "@/lib/domain/shop-branding";
import { storefrontTheme } from "@/lib/domain/web-theme";

export default function ShopOrdersPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const layout = useWebLayout();
  const { session, isLoading: isAuthLoading } = useAuth();

  const storefront = useQuery({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront(slug!),
    enabled: Boolean(slug),
  });
  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: getMyOrders,
    enabled: Boolean(session),
  });

  if (isAuthLoading || storefront.isLoading) return <Loading />;
  const shop = storefront.data?.shop;
  const accent = ACCENTS[shop ? resolveAccent(shop, ACCENTS.length) : 0];
  const theme = storefrontTheme(accent);

  const mine = (orders.data ?? []).filter(
    (order) => order.shop_id === shop?.id,
  );

  return (
    <>
      <Head>
        <title>{shop ? `Your orders · ${shop.name}` : "Your orders"}</title>
      </Head>
      <WebShell
        hero={
          <PageBand
            backLabel={shop?.name ?? "Back"}
            onBack={() => router.push(`/s/${slug}` as never)}
            title="Your orders here"
            theme={theme}
          />
        }
      >
        <View style={[styles.body, { padding: layout.gutter }]}>
          {!session ? (
            <View style={styles.card}>
              <Text style={styles.hint}>
                Enter the name and number you booked with.
              </Text>
              <GuestForm
                submitLabel="Show my orders"
                busyLabel="One moment…"
                onSignedIn={async () => {
                  await orders.refetch();
                }}
                theme={theme}
              />
            </View>
          ) : orders.isLoading ? (
            <Loading />
          ) : orders.error ? (
            <Text style={styles.hint}>
              We could not load your orders. Check your connection and try
              again.
            </Text>
          ) : mine.length === 0 ? (
            <Text style={styles.hint}>Nothing booked here yet.</Text>
          ) : (
            /* The same stub the app's home draws, chop and all: one ticket,
               whichever half of the product the customer is holding. */
            <View style={styles.grid}>
              {mine.map((order) => (
                <View key={order.id} style={styles.slot}>
                  <OrderStub
                    order={order}
                    shopName={shop?.name ?? "Laundry shop"}
                    accent={accent}
                    isLink
                    onPress={() => router.push(`/track/${order.id}` as never)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </WebShell>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.cosy },
  grid: { gap: space.cosy },
  /** One ticket to a row: a stub torn in half is not a stub. */
  slot: { width: "100%" },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
  },
  hint: { ...type.caption, color: colors.subtle },
});
