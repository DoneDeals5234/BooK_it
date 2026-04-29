const FAVORITE_SHOPS_STORAGE_KEY = 'barber_favorite_shops';

// Get all favorite shop IDs
export const getFavoriteShops = (): string[] => {
  try {
    const favorites = localStorage.getItem(FAVORITE_SHOPS_STORAGE_KEY);
    return favorites ? JSON.parse(favorites) : [];
  } catch (error) {
    console.error('Error reading favorite shops from localStorage:', error);
    return [];
  }
};

// Save favorite shops to localStorage
const saveFavoriteShops = (favorites: string[]): void => {
  try {
    localStorage.setItem(FAVORITE_SHOPS_STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorite shops to localStorage:', error);
  }
};

// Check if a shop is in favorites
export const isFavorite = (shopId: string): boolean => {
  return getFavoriteShops().includes(shopId);
};

// Add a shop to favorites
export const addFavoriteShop = (shopId: string): void => {
  const favorites = getFavoriteShops();
  if (!favorites.includes(shopId)) {
    favorites.push(shopId);
    saveFavoriteShops(favorites);
  }
};

// Remove a shop from favorites
export const removeFavoriteShop = (shopId: string): void => {
  const favorites = getFavoriteShops();
  const filtered = favorites.filter(id => id !== shopId);
  saveFavoriteShops(filtered);
};

// Toggle favorite status
export const toggleFavoriteShop = (shopId: string): boolean => {
  if (isFavorite(shopId)) {
    removeFavoriteShop(shopId);
    return false;
  } else {
    addFavoriteShop(shopId);
    return true;
  }
};

// Clear all favorites
export const clearAllFavorites = (): void => {
  saveFavoriteShops([]);
};
