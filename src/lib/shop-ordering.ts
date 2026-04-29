import type { Shop } from '@/lib/shops-storage';

/**
 * Apply ordering to shops: pinned shops first (sorted by pinOrder),
 * followed by randomized non-pinned shops
 */
export const applyShopOrdering = (shops: Shop[]): Shop[] => {
  // Separate pinned and non-pinned shops
  const pinnedShops = shops.filter((shop) => shop.isPinned).sort((a, b) => (a.pinOrder || 999) - (b.pinOrder || 999));
  const nonPinnedShops = shops.filter((shop) => !shop.isPinned);

  // Randomize non-pinned shops
  const randomizedNonPinned = [...nonPinnedShops].sort(() => Math.random() - 0.5);

  // Combine: pinned first, then randomized non-pinned
  return [...pinnedShops, ...randomizedNonPinned];
};

/**
 * Get ordered shops from sessionStorage or apply ordering if not cached
 * This ensures consistent ordering during the session but randomizes on refresh
 *
 * Key behavior:
 * - Pinned shops always appear first (respecting pin_order)
 * - Non-pinned shops are randomized but cached in session
 * - When shops change (e.g., pinning), the cache is cleared and recalculated
 */
export const getOrderedShops = (shops: Shop[]): Shop[] => {
  const sessionKey = 'shop_ordering_cache';

  // Always separate pinned and non-pinned shops based on current is_pinned status
  const pinnedShops = shops.filter((shop) => shop.isPinned).sort((a, b) => (a.pinOrder || 999) - (b.pinOrder || 999));
  const nonPinnedShops = shops.filter((shop) => !shop.isPinned);

  // Get cached randomization for non-pinned shops
  const cached = sessionStorage.getItem(sessionKey);

  if (cached && nonPinnedShops.length > 0) {
    try {
      const cachedIds = JSON.parse(cached) as string[];
      // Create a map of non-pinned shops
      const nonPinnedMap = new Map(nonPinnedShops.map((s) => [s.id, s]));
      const randomized: Shop[] = [];

      // Add shops in cached order (if they still exist in non-pinned list)
      cachedIds.forEach((id) => {
        const shop = nonPinnedMap.get(id);
        if (shop) {
          randomized.push(shop);
          nonPinnedMap.delete(id);
        }
      });

      // Add any new non-pinned shops that weren't in the cache
      randomized.push(...Array.from(nonPinnedMap.values()));

      // Return pinned shops first, then randomized non-pinned shops
      return [...pinnedShops, ...randomized];
    } catch (error) {
      console.error('Error reading shop ordering cache:', error);
    }
  }

  // If no cache, randomize non-pinned shops and cache the order
  const randomized = [...nonPinnedShops].sort(() => Math.random() - 0.5);
  if (randomized.length > 0) {
    const ids = randomized.map((s) => s.id);
    sessionStorage.setItem(sessionKey, JSON.stringify(ids));
  }

  // Return pinned shops first, then randomized non-pinned shops
  return [...pinnedShops, ...randomized];
};

/**
 * Clear the shop ordering cache (call this on page refresh or manual refresh)
 */
export const clearShopOrderingCache = (): void => {
  sessionStorage.removeItem('shop_ordering_cache');
};
