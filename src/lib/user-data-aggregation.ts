import { getShopsByUserId } from '@/lib/supabase-shop-owners';
import { getNativeShopsByUserId } from '@/lib/supabase-native-shop-owners';
import { getShopById } from '@/lib/shops-storage';
import { getLatestPlanForEmail, type ShopOwnerPlan } from '@/lib/supabase-shop-owner-plans';
import { isCapacitor } from '@/lib/capacitor-notifications';
import type { Shop } from '@/lib/shops-storage';

export interface AggregatedUserData {
  userId: string;
  email: string;
  isShopOwner: boolean;
  shopOwnerData?: {
    shopId: string;
    shop?: Shop | null;
  };
  activePlan?: ShopOwnerPlan | null;
}

/**
 * Aggregates all user-linked data after sign-in
 * Strategy:
 * 1. Check device type (web vs native)
 * 2. For web: check shop_owners first, then fallback to native_shop_owners
 * 3. For native: check native_shop_owners first, then fallback to shop_owners
 * 4. If shop owner found, fetch shop data and latest plan
 */
export async function aggregateUserDataAfterSignIn(
  userId: string,
  email: string
): Promise<AggregatedUserData> {
  try {
    console.log('📊 Starting user data aggregation for:', { userId, email });

    const result: AggregatedUserData = {
      userId,
      email,
      isShopOwner: false,
    };

    // Determine device type and check shop owner status
    const isNativeEnvironment = isCapacitor();
    console.log(`🔍 Device environment: ${isNativeEnvironment ? 'native' : 'web'}`);

    let shopOwnerRecord = null;

    if (isNativeEnvironment) {
      // For native: check native_shop_owners first
      console.log('📱 Checking native_shop_owners table first...');
      const nativeShops = await getNativeShopsByUserId(userId);
      if (nativeShops && nativeShops.length > 0) {
        shopOwnerRecord = nativeShops[0]; // One user = one shop
        console.log('✅ Found in native_shop_owners:', shopOwnerRecord);
      } else {
        // Fallback to shop_owners
        console.log('⚠️ Not found in native_shop_owners, checking shop_owners...');
        const webShops = await getShopsByUserId(userId);
        if (webShops && webShops.length > 0) {
          shopOwnerRecord = webShops[0];
          console.log('✅ Found in shop_owners:', shopOwnerRecord);
        }
      }
    } else {
      // For web: check shop_owners first
      console.log('🌐 Checking shop_owners table first...');
      const webShops = await getShopsByUserId(userId);
      if (webShops && webShops.length > 0) {
        shopOwnerRecord = webShops[0]; // One user = one shop
        console.log('✅ Found in shop_owners:', shopOwnerRecord);
      } else {
        // Fallback to native_shop_owners
        console.log('⚠️ Not found in shop_owners, checking native_shop_owners...');
        const nativeShops = await getNativeShopsByUserId(userId);
        if (nativeShops && nativeShops.length > 0) {
          shopOwnerRecord = nativeShops[0];
          console.log('✅ Found in native_shop_owners:', shopOwnerRecord);
        }
      }
    }

    // If shop owner found, fetch shop data
    if (shopOwnerRecord) {
      result.isShopOwner = true;
      result.shopOwnerData = {
        shopId: shopOwnerRecord.shopId,
      };

      try {
        console.log('🏪 Fetching shop data for shop ID:', shopOwnerRecord.shopId);
        const shop = await getShopById(shopOwnerRecord.shopId);
        result.shopOwnerData.shop = shop;
        console.log('✅ Shop data fetched:', shop?.name);
      } catch (shopError) {
        console.error('❌ Error fetching shop data:', shopError);
        // Continue even if shop fetch fails
      }
    }

    // Fetch latest plan for this user's email
    try {
      console.log('💳 Fetching latest plan for email:', email);
      const plan = await getLatestPlanForEmail(email);
      if (plan) {
        result.activePlan = plan;
        console.log('✅ Active plan found:', plan.plan_name);
      } else {
        console.log('⚠️ No active plan found for this user');
      }
    } catch (planError) {
      console.error('❌ Error fetching plan:', planError);
      // Continue even if plan fetch fails
    }

    console.log('✅ User data aggregation complete:', {
      userId: result.userId,
      email: result.email,
      isShopOwner: result.isShopOwner,
      shopId: result.shopOwnerData?.shopId,
      planName: result.activePlan?.plan_name,
    });

    return result;
  } catch (error) {
    console.error('❌ Critical error in aggregateUserDataAfterSignIn:', error);
    // Return minimal data structure on error
    return {
      userId,
      email,
      isShopOwner: false,
    };
  }
}
