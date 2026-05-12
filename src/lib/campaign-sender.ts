import { supabase } from './supabase';

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

/**
 * Sends a campaign via the send-realtime-campaign Edge Function
 * This triggers both instant Realtime broadcast and FCM backup
 */
export async function sendCampaignDirectly(
  campaign: Campaign,
  target: CampaignTarget
): Promise<{ success: boolean; matchedCount: number; sentCount: number }> {
  console.log('🚀 Starting hybrid campaign send (Realtime + FCM Native)...');

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

    // 2. Query matched users for logging
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
