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



