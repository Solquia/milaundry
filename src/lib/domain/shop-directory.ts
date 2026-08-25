export interface DirectoryShop {
  id: string;
  is_active: boolean;
}

/**
 * Splits the shop list a customer can see into the ones they have already
 * joined and the ones they could still connect to. Deactivated shops are
 * hidden from discovery, but stay visible when already joined so past orders
 * keep their shop context.
 */
export function splitShopsByRegistration<T extends DirectoryShop>(
  shops: readonly T[],
  registeredShopIds: readonly string[]
): { mine: T[]; discoverable: T[] } {
  const registered = new Set(registeredShopIds);
  const mine: T[] = [];
  const discoverable: T[] = [];

  for (const shop of shops) {
    if (registered.has(shop.id)) {
      mine.push(shop);
    } else if (shop.is_active) {
      discoverable.push(shop);
    }
  }

  return { mine, discoverable };
}
