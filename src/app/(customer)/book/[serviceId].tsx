/**
 * Booking a service in the app. The flow itself is `components/booking-flow`,
 * which the shop's web page renders too; this screen loads what it needs, says
 * why when booking cannot start, and hosts it in the app's own screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { BookingFlow, type BookingFrameProps } from '@/components/booking-flow';
import { BookingProblem } from '@/components/booking-parts';
import { Loading, Screen, colors, space } from '@/components/ui-kit';
import {
  getMyLaundryPreferences,
  getOrder,
  getServices,
  getShop,
  getShopAddonGroups,
  getShopAddons,
} from '@/lib/api';
import { describeCatalogProblem, isConnectionError } from '@/lib/domain/booking-error';
import { seedBooking } from '@/lib/domain/booking-seed';
import { NO_PREFERENCES, supportedPreferenceKeys } from '@/lib/domain/laundry-preferences';
import { rebookDraft, reconcileRebook } from '@/lib/domain/rebook';

/** The app's screen around the steps, with the buy bar pinned underneath. */
function AppFrame({ footer, children }: BookingFrameProps) {
  return (
    <Screen footer={footer} isBottomBare>
      {children}
    </Screen>
  );
}

/**
 * Everything a booking needs before its first frame: the price list, whether
 * the shop is still open for bookings, and — on "Book again" — the order being
 * repeated. The flow below is keyed and seeded from these once, so nothing
 * has to be written into its fields by an effect racing the customer's thumb.
 */
export default function BookService() {
  const { serviceId, shopId, rebook } = useLocalSearchParams<{
    serviceId: string;
    shopId: string;
    rebook?: string;
  }>();
  const router = useRouter();

  const catalog = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId!),
    enabled: Boolean(shopId),
  });
  // Customers can only read active shops, so a shop switched off answers with
  // no row at all — which is exactly the "not taking bookings" case.
  const shop = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => getShop(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });
  const previous = useQuery({
    queryKey: ['order', rebook],
    queryFn: () => getOrder(rebook!),
    enabled: Boolean(rebook),
  });

  // The customer's usual wash. A failure here only costs the prefill, so it
  // is not a reason to block the booking.
  const usual = useQuery({
    queryKey: ['my-laundry-preferences'],
    queryFn: getMyLaundryPreferences,
    retry: false,
  });

  // The shop's priced add-ons. Failing to load them costs the shelf, not the
  // booking: the free preference tiles stand in.
  const shelf = useQuery({
    queryKey: ['shop-addons', shopId],
    queryFn: () => getShopAddons(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });
  // Whether each kind is pick-one or pick-several at this shop. Failing to
  // load it falls back to the house rule; the server checks either way.
  const shelfRules = useQuery({
    queryKey: ['shop-addon-groups', shopId],
    queryFn: () => getShopAddonGroups(shopId!),
    enabled: Boolean(shopId),
    retry: false,
  });

  /**
   * Out of the booking, to the shop's menu. Nothing is saved until "Place
   * order", so a customer who changed their mind loses nothing by leaving —
   * and lands where they can pick another service instead of on Home. A
   * replace, not a back: under tabs, back goes to the first tab, not the shop.
   */
  const leave = React.useCallback(() => {
    if (shopId) router.replace(`/(customer)/shop/${shopId}` as never);
    else router.back();
  }, [router, shopId]);

  // The bar names who you are booking with, not what the screen is for, and
  // carries the way out on every step.
  const navigation = useNavigation();
  const shopName = shop.data?.name;
  useEffect(() => {
    navigation.setOptions({
      ...(shopName ? { title: shopName } : {}),
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave booking and go back to the shop"
          onPress={leave}
          hitSlop={10}
          style={({ pressed }) => [styles.headerBack, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, shopName, leave]);

  if (
    catalog.isLoading ||
    shop.isLoading ||
    previous.isLoading ||
    usual.isLoading ||
    shelf.isLoading ||
    shelfRules.isLoading
  ) {
    return <Loading />;
  }

  const draft = previous.data ? rebookDraft(previous.data) : null;
  const service = catalog.data?.find((row) => row.id === serviceId);
  const shopError = shop.error instanceof Error ? shop.error : null;
  const isShopUnreachable = Boolean(shopError && isConnectionError(shopError.message));

  const problem = describeCatalogProblem({
    hasShopId: Boolean(shopId),
    loadError: catalog.error ?? (isShopUnreachable ? shopError : null),
    isServiceFound: Boolean(service),
    isShopAvailable: shop.data
      ? shop.data.is_active
      : shopError && !isShopUnreachable
        ? false
        : undefined,
    rebookServiceName: draft?.itemNames[draft.serviceId],
    rebookLoadError: previous.error,
  });

  if (problem) {
    const canOpenShop = Boolean(shop.data?.is_active) && !problem.canRetry;
    return (
      <BookingProblem
        problem={problem}
        onRetry={() => {
          void catalog.refetch();
          void shop.refetch();
          if (rebook) void previous.refetch();
        }}
        onBack={() => router.back()}
        onOpenShop={
          canOpenShop ? () => router.replace(`/(customer)/shop/${shopId}` as never) : undefined
        }
      />
    );
  }

  // Unreachable: describeCatalogProblem always reports a missing service above.
  if (!service || !catalog.data || !shopId) return null;

  const reconciled = draft
    ? reconcileRebook(draft, catalog.data.map((row) => row.id))
    : null;
  const supported = supportedPreferenceKeys(shop.data?.supported_preferences);
  const seed = seedBooking({
    draft: reconciled?.draft ?? null,
    droppedNames: reconciled?.droppedNames ?? [],
    previousPickupAt: previous.data?.pickup_at ?? null,
    usual: usual.data ?? NO_PREFERENCES,
    supported,
    service,
    services: catalog.data,
    now: new Date(),
  });

  return (
    <BookingFlow
      key={`${serviceId}:${rebook ?? ''}`}
      shopId={shopId}
      service={service}
      services={catalog.data}
      supported={supported}
      seed={seed}
      shopAddons={shelf.data ?? []}
      addonRules={shelfRules.data ?? {}}
      Frame={AppFrame}
      onPlaced={(order) => router.replace(`/(customer)/order/${order.id}`)}
      onCheckOrders={() => router.push('/(customer)/orders' as never)}
    />
  );
}

const styles = StyleSheet.create({
  headerBack: { marginLeft: space.snug, padding: space.tight },
});
