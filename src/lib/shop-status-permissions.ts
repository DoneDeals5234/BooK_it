import { supabase } from '@/lib/supabase';

/**
 * When shop owner opens/closes their shop, automatically toggle the foreground service permission
 * 
 * APPROACH 1 + Shop Status Integration:
 * - When shop is OPEN: auto_start_foreground_service = true
 *   → Foreground service can run and monitor appointments
 * - When shop is CLOSED: auto_start_foreground_service = false
 *   → Foreground service won't start automatically
 * 
 * This allows shop owners to simply open/close their shop without separate permission management
 */
export async function toggleShopStatusAndPermission(
  userId: string,
  shopId: string,
  isOpen: boolean
): Promise<boolean> {
  try {
    console.log(`🏪 Updating shop status for user: ${userId}, shop: ${shopId}`);
    console.log(`   Shop is now: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);

    // Update the auto_start_foreground_service permission to match shop status
    // When shop opens, enable foreground service
    // When shop closes, disable foreground service
    const { error } = await supabase
      .from('native_shop_owners')
      .update({
        auto_start_foreground_service: isOpen, // true if open, false if closed
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('shop_id', shopId);

    if (error) {
      console.error('❌ Error updating permission:', error);
      return false;
    }

    if (isOpen) {
      console.log(`✅ Shop opened - Foreground service permission ENABLED`);
      console.log(`   Foreground service can now run when customers book appointments`);
    } else {
      console.log(`✅ Shop closed - Foreground service permission DISABLED`);
      console.log(`   Foreground service will not run automatically`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error in toggleShopStatusAndPermission:', error);
    return false;
  }
}

/**
 * Get current foreground service status for a shop
 * (whether the shop is open and permission is enabled)
 */
export async function getShopForegroundServiceStatus(
  userId: string,
  shopId: string
): Promise<{ isPermissionEnabled: boolean; isShopOpen: boolean }> {
  try {
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('auto_start_foreground_service')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      console.warn('⚠️ Error fetching permission status:', error);
      return { isPermissionEnabled: false, isShopOpen: false };
    }

    return {
      isPermissionEnabled: data?.auto_start_foreground_service === true,
      isShopOpen: data?.auto_start_foreground_service === true,
    };
  } catch (error) {
    console.error('❌ Error in getShopForegroundServiceStatus:', error);
    return { isPermissionEnabled: false, isShopOpen: false };
  }
}
