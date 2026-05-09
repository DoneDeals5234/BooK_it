import {
  getAllShopsFromSupabase,
  getShopByIdFromSupabase,
  addShopToSupabase,
  updateShopInSupabase,
  deleteShopFromSupabase,
  seedDefaultShops,
} from '@/lib/supabase-shops';

export interface BarberMember {
  id: string;
  name: string;
  experience: string;
  imageUrl: string;
}

export interface Service {
  id: string;
  name: string;
  price: string;
}

export interface TimeSlotSetting {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  slotDurationMinutes: number; // 10, 15, 20, 30, etc.
  enabled: boolean;
}

export interface Shop {
  id: string;
  name: string;
  location: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  about: string;
  shopImageUrl: string;
  shopInteriorVideoUrl?: string | null;
  locationImageUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  barberMembers: BarberMember[];
  services: Service[];
  interiorImages?: string[];
  password: string;
  isOpen: boolean;
  tokenBookingPaused: boolean;
  openingTime: string;
  closingTime: string;
  timeSlotSettings?: TimeSlotSetting[];
  category: string; // Can be predefined or custom
  categoryId?: string | null;
  createdAt: Date;
  lastPingTime?: Date | null;
  displayStatus?: 'online' | 'recently_online' | 'offline';
  isPinned?: boolean;
  pinOrder?: number;
  isWebsiteBuilderEnabled?: boolean;
  isTokenBookingEnabled?: boolean;
  upiId?: string;
  advancePaymentMode?: 'none' | 'optional' | 'compulsory';
  instagramId?: string;
  facebookId?: string;
}

// Get all shops from Supabase
export const getShops = async (): Promise<Shop[]> => {
  return await getAllShopsFromSupabase();
};

// Get a single shop by ID
export const getShopById = async (id: string): Promise<Shop | null> => {
  return await getShopByIdFromSupabase(id);
};

// Add a new shop
export const addShop = async (
  shop: Omit<Shop, 'id' | 'createdAt' | 'isOpen' | 'tokenBookingPaused'>
): Promise<Shop | null> => {
  return await addShopToSupabase(shop);
};

// Check if a shop is currently open based on opening/closing times
export const isShopCurrentlyOpen = (openingTime: string, closingTime: string): boolean => {
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  return currentTime >= openingTime && currentTime < closingTime;
};

// Delete a shop
export const deleteShop = async (id: string): Promise<boolean> => {
  return await deleteShopFromSupabase(id);
};

// Update a shop
export const updateShop = async (
  id: string,
  updates: Partial<Omit<Shop, 'id' | 'createdAt'>>
): Promise<Shop | null> => {
  return await updateShopInSupabase(id, updates);
};

// Seed default shops on first load
export const initializeShops = async (): Promise<void> => {
  try {
    await seedDefaultShops();
  } catch (error) {
    console.warn('⚠️ Warning during shops initialization:', error instanceof Error ? error.message : String(error));
    // Don't throw - allow app to continue even if seeding fails
  }
};
