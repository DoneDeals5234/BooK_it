/**
 * shops-cache.ts
 * 
 * LocalStorage based caching for shops and categories.
 * On first load: fetches from Supabase and saves to cache.
 * On subsequent loads: instantly returns cached data, then silently refreshes in background.
 */

import type { Shop } from '@/lib/shops-storage';
import type { Category } from '@/types/index';

const SHOPS_CACHE_KEY = 'bookit_shops_cache';
const CATEGORIES_CACHE_KEY = 'bookit_categories_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // Increased to 1 hour for better UX

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    // localStorage can fail in private/incognito mode — silently ignore
  }
}

/**
 * Load from cache.
 * Returns data even if expired to avoid showing loading bars.
 * The UI should still trigger a background refresh.
 */
function loadFromCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    
    // Check if totally stale (e.g. 24 hours) - only then return null
    const isStale = Date.now() - entry.timestamp > 24 * 60 * 60 * 1000;
    if (isStale) return null;
    
    return entry.data;
  } catch (e) {
    return null;
  }
}

/** Check if cache is older than TTL */
export function isCacheExpired(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
  } catch (e) {
    return true;
  }
}

/** Save shops to cache */
export function cacheShops(shops: Shop[]): void {
  saveToCache(SHOPS_CACHE_KEY, shops);
}

/** Load shops from cache */
export function getCachedShops(): Shop[] | null {
  return loadFromCache<Shop[]>(SHOPS_CACHE_KEY);
}

export function areShopsExpired(): boolean {
  return isCacheExpired(SHOPS_CACHE_KEY);
}

/** Save categories to cache */
export function cacheCategories(categories: Category[]): void {
  saveToCache(CATEGORIES_CACHE_KEY, categories);
}

/** Load categories from cache */
export function getCachedCategories(): Category[] | null {
  return loadFromCache<Category[]>(CATEGORIES_CACHE_KEY);
}

export function areCategoriesExpired(): boolean {
  return isCacheExpired(CATEGORIES_CACHE_KEY);
}

/** Invalidate all caches (e.g. on pull-to-refresh) */
export function invalidateAllCaches(): void {
  try {
    localStorage.removeItem(SHOPS_CACHE_KEY);
    localStorage.removeItem(CATEGORIES_CACHE_KEY);
    localStorage.removeItem('bookit_bazar_products_cache'); // Clear bazar too
  } catch (e) {
    // ignore
  }
}
