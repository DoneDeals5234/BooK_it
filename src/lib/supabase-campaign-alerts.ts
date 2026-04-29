import { supabase } from '@/lib/supabase';

export interface CampaignAlert {
  id: string;
  userId: string;
  campaignId: string;
  shopId: string;
  campaignTitle: string;
  campaignMessage: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date | null;
  expiresAt: Date;
}

export interface TargetedCampaign {
  id: string;
  campaignId: string;
  shopId: string;
  title: string;
  message: string;
  description?: string;
  status: string;
  matchedAt: Date;
  createdAt: Date;
}

/**
 * Save a campaign alert for a user
 * Called when a campaign is sent to notify users of incoming campaigns
 */
export const saveCampaignAlert = async (
  userId: string,
  campaignId: string,
  shopId: string,
  title: string,
  message: string
): Promise<CampaignAlert | null> => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expire alerts after 30 days

    const { data, error } = await supabase
      .from('user_campaign_alerts')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        shop_id: shopId,
        campaign_title: title,
        campaign_message: message,
        is_read: false,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving campaign alert:', error.message || JSON.stringify(error));
      return null;
    }

    return mapCampaignAlert(data);
  } catch (error) {
    console.error('Error in saveCampaignAlert:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
};

/**
 * Get all unread campaign alerts for a user
 */
export const getUserCampaignAlerts = async (userId: string): Promise<CampaignAlert[]> => {
  try {
    const { data, error } = await supabase
      .from('user_campaign_alerts')
      .select('*')
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaign alerts:', error);
      return [];
    }

    return (data || []).map(mapCampaignAlert);
  } catch (error) {
    console.error('Error in getUserCampaignAlerts:', error);
    return [];
  }
};

/**
 * Get unread alerts only
 */
export const getUnreadCampaignAlerts = async (userId: string): Promise<CampaignAlert[]> => {
  try {
    const { data, error } = await supabase
      .from('user_campaign_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unread alerts:', error);
      return [];
    }

    return (data || []).map(mapCampaignAlert);
  } catch (error) {
    console.error('Error in getUnreadCampaignAlerts:', error);
    return [];
  }
};

/**
 * Mark a campaign alert as read
 */
export const markCampaignAlertAsRead = async (alertId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_campaign_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      console.error('Error marking alert as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markCampaignAlertAsRead:', error);
    return false;
  }
};

/**
 * Delete a campaign alert (user dismissed it)
 */
export const deleteCampaignAlert = async (alertId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_campaign_alerts')
      .delete()
      .eq('id', alertId);

    if (error) {
      console.error('Error deleting campaign alert:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteCampaignAlert:', error);
    return false;
  }
};

/**
 * Delete multiple alerts (batch operation)
 */
export const deleteCampaignAlerts = async (alertIds: string[]): Promise<boolean> => {
  try {
    if (alertIds.length === 0) return true;

    const { error } = await supabase
      .from('user_campaign_alerts')
      .delete()
      .in('id', alertIds);

    if (error) {
      console.error('Error deleting campaign alerts:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteCampaignAlerts:', error);
    return false;
  }
};

/**
 * Subscribe to real-time campaign alert updates for a user
 */
export const subscribeToUserCampaignAlerts = (
  userId: string,
  callback: (alerts: CampaignAlert[]) => void
) => {
  const channel = supabase
    .channel(`campaign_alerts_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_campaign_alerts',
        filter: `user_id=eq.${userId}`,
      },
      async () => {
        // Fetch updated alerts when database changes
        const alerts = await getUserCampaignAlerts(userId);
        callback(alerts);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Unsubscribe from real-time updates
 */
export const unsubscribeFromCampaignAlerts = (channel: any) => {
  supabase.removeChannel(channel);
};

/**
 * Get campaigns that targeted this user (from campaign_matched_users table)
 * This shows campaigns that matched the user's location/criteria even if alert wasn't explicitly created
 */
export const getUserTargetedCampaigns = async (userId: string): Promise<TargetedCampaign[]> => {
  try {
    const { data, error } = await supabase
      .from('campaign_matched_users')
      .select(`
        id,
        campaign_id,
        matched_at,
        campaigns (
          id,
          shop_id,
          title,
          message,
          description,
          status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('matched_at', { ascending: false });

    if (error) {
      console.error('Error fetching targeted campaigns:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      campaignId: item.campaign_id,
      shopId: item.campaigns.shop_id,
      title: item.campaigns.title,
      message: item.campaigns.message,
      description: item.campaigns.description,
      status: item.campaigns.status,
      matchedAt: new Date(item.matched_at),
      createdAt: new Date(item.campaigns.created_at),
    }));
  } catch (error) {
    console.error('Error in getUserTargetedCampaigns:', error);
    return [];
  }
};

// Helper function to map database record to interface
const mapCampaignAlert = (item: any): CampaignAlert => ({
  id: item.id,
  userId: item.user_id,
  campaignId: item.campaign_id,
  shopId: item.shop_id,
  campaignTitle: item.campaign_title,
  campaignMessage: item.campaign_message,
  isRead: item.is_read,
  createdAt: new Date(item.created_at),
  readAt: item.read_at ? new Date(item.read_at) : null,
  expiresAt: new Date(item.expires_at),
});
