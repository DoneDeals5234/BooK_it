import { supabase } from '@/lib/supabase';

/**
 * Check if owner has granted permission for automatic foreground service start
 * This is Approach 1: Owner must explicitly grant permission during onboarding
 */
export async function checkOwnerForegroundServicePermission(
  userId: string,
  shopId: string
): Promise<boolean> {
  try {
    console.log(`🔐 Checking foreground service permission for user: ${userId}, shop: ${shopId}`);

    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('auto_start_foreground_service')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      console.warn('⚠️ Error checking permission:', error);
      return false;
    }

    const hasPermission = data?.auto_start_foreground_service === true;
    console.log(`🔐 Permission status: ${hasPermission ? '✅ GRANTED' : '❌ DENIED'}`);
    return hasPermission;
  } catch (error) {
    console.error('❌ Error in checkOwnerForegroundServicePermission:', error);
    return false;
  }
}

/**
 * Grant or revoke owner permission for automatic foreground service start
 * Called during onboarding or in settings
 */
export async function setOwnerForegroundServicePermission(
  userId: string,
  shopId: string,
  hasPermission: boolean
): Promise<boolean> {
  try {
    console.log(`🔐 Setting foreground service permission: ${hasPermission ? '✅ GRANT' : '❌ REVOKE'}`);

    const { error } = await supabase
      .from('native_shop_owners')
      .update({
        auto_start_foreground_service: hasPermission,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('shop_id', shopId);

    if (error) {
      console.error('❌ Error updating permission:', error);
      return false;
    }

    console.log(`✅ Permission updated successfully`);
    return true;
  } catch (error) {
    console.error('❌ Error in setOwnerForegroundServicePermission:', error);
    return false;
  }
}

/**
 * Get all shop owners for a shop that have granted permission
 * Only these owners will receive the automatic foreground service trigger
 */
export async function getAuthorizedOwnersByShopId(shopId: string): Promise<string[]> {
  try {
    console.log(`🔐 Fetching authorized owners for shop: ${shopId}`);

    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('user_id')
      .eq('shop_id', shopId)
      .eq('auto_start_foreground_service', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching authorized owners:', error);
      return [];
    }

    const ownerIds = data?.map((item) => item.user_id) || [];
    console.log(`✅ Found ${ownerIds.length} authorized owner(s): ${ownerIds.join(', ')}`);
    return ownerIds;
  } catch (error) {
    console.error('❌ Error in getAuthorizedOwnersByShopId:', error);
    return [];
  }
}
