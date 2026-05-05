import { supabase } from './supabase';
import { saveCampaignAlert } from './supabase-campaign-alerts';

interface CampaignTarget {
  country: string;
  state?: string;
  district?: string;
  village?: string;
}

interface Campaign {
  id: string;
  title: string;
  message: string;
  image_url?: string;
  shop_id?: string;
}

const ONESIGNAL_NATIVE_APP_ID =
  import.meta.env.VITE_ONESIGNAL_NATIVE_APP_ID ||
  "1f14fad4-0d2f-465a-b3a8-e0e976b8729f";

const ONESIGNAL_API_KEY =
  import.meta.env.VITE_ONESIGNAL_NATIVE_API_KEY ||
  "os_v2_app_d4kpvvanf5dfvm5i4duxnodst76akwxbdjquqneohglqc6iifuuhdn4av55a3hnrju3zbhm52yuf7ga3gzuqhjggxzseurcjfrnmc5y";

/**
 * Sends a campaign via the send-realtime-campaign Edge Function
 * This triggers both instant Realtime broadcast and OneSignal backup
 */
export async function sendCampaignDirectly(
  campaign: Campaign,
  target: CampaignTarget
): Promise<{ success: boolean; matchedCount: number; sentCount: number }> {
  console.log('🚀 Starting hybrid campaign send (Realtime + OneSignal)...');

  try {
    // 1. Call the Edge Function
    const { data, error } = await supabase.functions.invoke('send-realtime-campaign', {
      body: {
        campaign_id: campaign.id,
        target: target
      }
    });

    if (error) {
      console.error('❌ Edge Function error:', error);
      throw new Error(`Failed to trigger campaign: ${error.message}`);
    }

    console.log('✅ Campaign triggered successfully:', data);

    // 2. Query matched users for logging (optional, could be moved to server)
    const { data: matchedUsers } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('country', target.country)
      .match({
        ...(target.state ? { state: target.state } : {}),
        ...(target.district ? { district: target.district } : {}),
        ...(target.village ? { village: target.village } : {}),
      });

    const count = matchedUsers?.length || 0;

    return {
      success: true,
      matchedCount: count,
      sentCount: count,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('❌ Campaign send failed:', errorMessage);
    throw error;
  }
}
