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

export async function sendCampaignDirectly(
  campaign: Campaign,
  target: CampaignTarget
): Promise<{ success: boolean; matchedCount: number; sentCount: number }> {
  console.log('🚀 Starting hybrid campaign send (Realtime + FCM Native)...');

  try {
    // 1. Try to call the Edge Function first
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-realtime-campaign', {
      body: {
        campaign_id: campaign.id,
        target: target
      }
    });

    if (!edgeError) {
      console.log('✅ Campaign triggered successfully via Edge Function:', edgeData);
      return {
        success: true,
        matchedCount: edgeData.users_targeted || 0,
        sentCount: edgeData.users_targeted || 0,
      };
    }

    console.warn('⚠️ Edge Function failed or not deployed, falling back to direct client execution...', edgeError);

    // 2. Fetch full campaign data
    const { data: campaignData, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign.id)
      .single();

    if (fetchError || !campaignData) {
      throw new Error(`Failed to fetch campaign data: ${fetchError?.message}`);
    }

    // 3. Trigger Realtime Broadcast directly
    console.log('📡 Inserting into campaign_broadcasts...');
    const { error: broadcastError } = await supabase
      .from('campaign_broadcasts')
      .insert({
        campaign_id: campaignData.id,
        title: campaignData.title,
        message: campaignData.message,
        image_url: campaignData.image_url,
        shop_id: campaignData.shop_id,
        target: target || {}
      });

    if (broadcastError) {
      console.warn('⚠️ Realtime broadcast insert failed (might need RLS update):', broadcastError.message);
    }

    // 4. Update Campaign Status
    await supabase
      .from('campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', campaign.id);

    // 5. Query matching users for FCM
    let query = supabase.from('user_profiles').select('user_id');
    if (target.country) query = query.eq('country', target.country);
    if (target.state) query = query.eq('state', target.state);
    if (target.district) query = query.eq('district', target.district);
    if (target.village) query = query.eq('village', target.village);

    const { data: matchedUsers } = await query;
    const userIds = (matchedUsers || []).map((u: any) => u.user_id).filter(Boolean);
    console.log(`🎯 Matched ${userIds.length} users by geography`);

    // 6. Trigger Native Notifications
    if (userIds.length > 0) {
      console.log(`🔥 Invoking send-native-notification for ${userIds.length} users...`);
      await supabase.functions.invoke('send-native-notification', {
        body: {
          userIds,
          title: campaignData.title,
          body: campaignData.message,
          data: {
            type: 'campaign',
            campaign_id: campaign.id,
            route: '/',
            ...(campaignData.image_url ? { imageUrl: campaignData.image_url } : {}),
            ...(campaignData.shop_id ? { shop_id: campaignData.shop_id } : {})
          }
        }
      });
    }

    return {
      success: true,
      matchedCount: userIds.length,
      sentCount: userIds.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('❌ Campaign send failed:', errorMessage);
    throw error;
  }
}
