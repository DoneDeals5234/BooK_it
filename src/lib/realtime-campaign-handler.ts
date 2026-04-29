import { supabase } from './supabase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getUserProfile } from './supabase-user-profiles';
import { auth } from './firebase';

export interface CampaignBroadcastPayload {
  id: string;
  title: string;
  message: string;
  image_url?: string;
  shop_id?: string;
  target?: {
    country?: string;
    state?: string;
    district?: string;
    village?: string;
  };
  sent_at: string;
}

let campaignChannel: any = null;

/**
 * Setup a global realtime listener for campaigns
 */
export async function setupCampaignRealtimeListener() {
  if (campaignChannel) {
    console.log('🔔 Campaign listener already active');
    return;
  }

  console.log('🔔 Setting up Realtime Campaign Listener...');

  // Subscribe to the campaign_broadcasts table changes
  campaignChannel = supabase
    .channel('campaign-broadcasts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'campaign_broadcasts',
      },
      async (payload: any) => {
        console.log('📡 Received campaign broadcast via DB:', payload.new);
        await handleIncomingCampaign(payload.new as CampaignBroadcastPayload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Campaign channel status:', status);
    });

  return () => {
    if (campaignChannel) {
      supabase.removeChannel(campaignChannel);
      campaignChannel = null;
    }
  };
}

/**
 * Handle an incoming campaign broadcast
 */
async function handleIncomingCampaign(campaign: CampaignBroadcastPayload) {
  try {
    // 1. Check Targeting
    if (campaign.target && Object.keys(campaign.target).length > 0) {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const profile = await getUserProfile(currentUser.uid);
      if (!profile) return;

      const { country, state, district, village } = campaign.target;

      // Simple location filtering
      if (country && profile.country !== country) return;
      if (state && profile.state !== state) return;
      if (district && profile.district !== district) return;
      if (village && profile.village !== village) return;
    }

    // 2. Trigger Local Notification
    if (Capacitor.isNativePlatform()) {
      console.log('📢 Triggering Local Notification for campaign:', campaign.title);
      
      const notificationId = Math.floor(Math.random() * 1000000);
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: campaign.title,
            body: campaign.message,
            largeIcon: campaign.image_url,
            extra: {
              campaign_id: campaign.id,
              type: 'campaign'
            },
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'default',
            actionTypeId: '',
            attachments: campaign.image_url ? [
              { id: 'image', url: campaign.image_url }
            ] : []
          }
        ]
      });
    } else {
      console.log('💻 Web platform: Notification received but not shown via LocalNotifications');
      // On web we could use a toast or browser notification API
    }
  } catch (error) {
    console.error('❌ Error handling incoming campaign:', error);
  }
}
