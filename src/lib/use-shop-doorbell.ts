/**
 * The shop doorbell, live: watches the order list, rings on a new booking,
 * and holds the banner the layout draws.
 *
 * Module-level `seen` and `enabled` so a merchant tab that remounts does not
 * treat the current list as a fresh first look and stay silent, or worse,
 * ring everything again.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { getShopOrders } from './api';
import { askToNotify, playDoorbell, postSystemNotice, unlockDoorbell } from './doorbell-sound';
import { loadDoorbellEnabled, saveDoorbellEnabled } from './doorbell-store';
import { hapticEffectFor } from './domain/haptic-feedback';
import {
  doorbellBanner,
  doorbellChannels,
  doorbellHeadline,
  nextDoorbell,
  testDoorbellChime,
  type DoorbellBannerCopy,
  type DoorbellOrder,
} from './domain/shop-doorbell';
import { performHaptic } from './haptics';
import { supabase } from './supabase';
import { useActiveShop } from './use-active-shop';

interface Snapshot {
  enabled: boolean;
  banner: DoorbellBannerCopy | null;
}

let snapshot: Snapshot = { enabled: true, banner: null };
let seen: Set<string> | null = null;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

function ensureLoaded(): Promise<void> {
  if (loaded) return loaded;
  loaded = loadDoorbellEnabled().then((enabled) => {
    publish({ enabled });
  });
  return loaded;
}

function ring(banner: DoorbellBannerCopy, appVisible: boolean): void {
  const channels = doorbellChannels(appVisible);
  if (channels.playSound) playDoorbell();
  if (channels.haptic) performHaptic(hapticEffectFor('warning', true));
  if (channels.banner) publish({ banner });
  if (channels.systemNotice) postSystemNotice(banner.title, banner.body);
}

function appIsVisible(): boolean {
  return AppState.currentState === 'active';
}

/**
 * Watches the shop's orders. Mount once, in the merchant shell, so a
 * settings card that also reads the bell does not subscribe twice.
 */
export function useShopDoorbellWatch(): void {
  const { shop } = useActiveShop();
  const queryClient = useQueryClient();

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const query = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!shop) return;
    const channel = supabase
      .channel(`shop-doorbell-${shop.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `shop_id=eq.${shop.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['shop-orders', shop.id] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [shop, queryClient]);

  useEffect(() => {
    if (!query.data) return;
    const orders: DoorbellOrder[] = query.data.map((row) => ({
      id: row.id,
      order_type: row.order_type,
      status: row.status,
      customer_name: row.customer_name,
    }));
    const next = nextDoorbell(seen, orders, snapshot.enabled);
    seen = next.seen;
    const notice = doorbellHeadline(next.chimes);
    if (!notice) return;
    ring(doorbellBanner(notice), appIsVisible());
  }, [query.data]);
}

export function useShopDoorbell(): {
  enabled: boolean;
  banner: DoorbellBannerCopy | null;
  setEnabled: (enabled: boolean) => void;
  testRing: () => void;
  open: () => void;
  dismiss: () => void;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const router = useRouter();

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    publish({ enabled });
    void saveDoorbellEnabled(enabled);
  }, []);

  const testRing = useCallback(() => {
    unlockDoorbell();
    askToNotify();
    ring(doorbellBanner(testDoorbellChime()), true);
  }, []);

  const dismiss = useCallback(() => {
    publish({ banner: null });
  }, []);

  const open = useCallback(() => {
    const orderId = snapshot.banner?.orderId;
    publish({ banner: null });
    if (!orderId || orderId === 'test') return;
    router.push(`/(merchant)/order/${orderId}`);
  }, [router]);

  return {
    enabled: current.enabled,
    banner: current.banner,
    setEnabled,
    testRing,
    open,
    dismiss,
  };
}
