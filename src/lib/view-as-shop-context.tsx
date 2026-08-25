import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from './supabase';
import type { Shop } from './types';

// Which shop a superadmin is currently viewing as merchant. Session-only by
// design: closing the app drops back to the admin console, never into a
// stale merchant view. The database re-checks the superadmin role on every
// query, so this context is navigation state, not an authorization boundary.

interface ViewAsShopContextValue {
  viewAsShop: Shop | null;
  openShopAsMerchant: (shop: Shop) => void;
  exitViewAs: () => void;
}

const ViewAsShopContext = createContext<ViewAsShopContextValue | null>(null);

export function ViewAsShopProvider({ children }: { children: React.ReactNode }) {
  const [viewAsShop, setViewAsShop] = useState<Shop | null>(null);

  const openShopAsMerchant = useCallback((shop: Shop) => setViewAsShop(shop), []);
  const exitViewAs = useCallback(() => setViewAsShop(null), []);

  // The view-as choice must not outlive the auth session that made it: signing
  // out (from any screen) drops it, so the next sign-in starts at the console.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setViewAsShop(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ viewAsShop, openShopAsMerchant, exitViewAs }),
    [viewAsShop, openShopAsMerchant, exitViewAs]
  );

  return (
    <ViewAsShopContext.Provider value={value}>{children}</ViewAsShopContext.Provider>
  );
}

export function useViewAsShop(): ViewAsShopContextValue {
  const ctx = useContext(ViewAsShopContext);
  if (!ctx) throw new Error('useViewAsShop must be used within ViewAsShopProvider');
  return ctx;
}
