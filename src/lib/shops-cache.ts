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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

function loadFromCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
    if (isExpired) return null;
    return entry.data;
  } catch (e) {
    return null;
  }
}

/** Save shops to cache */
export function cacheShops(shops: Shop[]): void {
  saveToCache(SHOPS_CACHE_KEY, shops);
}

/** Load shops from cache — returns null if no cache or expired */
export function getCachedShops(): Shop[] | null {
  return loadFromCache<Shop[]>(SHOPS_CACHE_KEY);
}

/** Save categories to cache */
export function cacheCategories(categories: Category[]): void {
  saveToCache(CATEGORIES_CACHE_KEY, categories);
}

/** Load categories from cache */
export function getCachedCategories(): Category[] | null {
  return loadFromCache<Category[]>(CATEGORIES_CACHE_KEY);
}

/** Invalidate all caches (e.g. on pull-to-refresh) */
export function invalidateAllCaches(): void {
  try {
    localStorage.removeItem(SHOPS_CACHE_KEY);
    localStorage.removeItem(CATEGORIES_CACHE_KEY);
  } catch (e) {
    // ignore
  }
}
