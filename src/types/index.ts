// Firebase Authentication types
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Shop Category types
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  displayOrder: number;
  createdAt: Date;
}

// Featured Product types
export interface FeaturedProduct {
  id: string;
  shopId: string;
  title: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  category?: string;
  imageUrl: string;
  images?: string[];
  description?: string;
  isActive: boolean;
  displayOrder: number;
  stock?: number;
  inventory?: number;
  maxPerCustomer?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Shop Offers types
export interface ShopOffer {
  id: string;
  shopId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  discountPercentage?: number;
  discountAmount?: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// OneSignal types for window object
declare global {
  interface Window {
    OneSignal?: {
      init: (options: OneSignalInitOptions) => Promise<void>;
      Slidedown?: {
        promptPush?: () => Promise<void> | void;
      };
      User: {
        getId?: () => Promise<string | null>;
        pushSubscription?: {
          getPushSubscriptionId?: () => Promise<string | null>;
        };
        PushSubscription?: {
          id?: string | null;
          optIn?: () => Promise<void>;
          optOut?: () => Promise<void>;
        };
      };
      Notifications?: {
        addEventListener?: (event: string, callback: (event: any) => void) => void;
        requestPermission?: (value: boolean) => Promise<boolean>;
      };
      getIds?: (callback: (ids: any) => void) => void;
      getDeviceState?: (callback: (state: any) => void) => void;
      getUserId?: (callback: (id: string) => void) => void;
      requestPermission?: (value: boolean, callback: () => void) => void;
      enablePush?: (value: boolean, callback: () => void) => void;
    };
    OneSignalInitialized?: boolean;
  }
}

interface OneSignalInitOptions {
  appId: string;
  notificationClickHandlerMatch?: string;
  notificationBehavior?: {
    desktop?: {
      icon?: string;
      badge?: string;
    };
    web?: {
      icon?: string;
      badge?: string;
    };
  };
}
