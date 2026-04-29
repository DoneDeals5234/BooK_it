import { supabase } from '@/lib/supabase';

export interface TemporaryChat {
  id: string;
  shop_id: string;
  user_name: string;
  user_email?: string;
  user_id?: string;
  message: string;
  created_at: string;
  expires_at: string;
}

// Add a temporary chat message
export const addTemporaryChatMessage = async (
  shopId: string,
  userName: string,
  message: string,
  userEmail?: string,
  userId?: string
): Promise<TemporaryChat | null> => {
  try {
    const { data, error } = await supabase
      .from('temporary_chats')
      .insert({
        shop_id: shopId,
        user_name: userName.trim(),
        user_email: userEmail?.trim() || null,
        user_id: userId || null,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding chat message:', error);
      return null;
    }

    return data as TemporaryChat;
  } catch (error) {
    console.error('❌ Error in addTemporaryChatMessage:', error);
    return null;
  }
};

// Get all non-expired chats for a shop
export const getChatsForShop = async (
  shopId: string,
  limit = 100
): Promise<TemporaryChat[]> => {
  try {
    const { data, error } = await supabase
      .from('temporary_chats')
      .select('*')
      .eq('shop_id', shopId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching chats:', error);
      return [];
    }

    return (data || []) as TemporaryChat[];
  } catch (error) {
    console.error('❌ Error in getChatsForShop:', error);
    return [];
  }
};

// Get chat count for a shop
export const getChatCountForShop = async (shopId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('temporary_chats')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('❌ Error getting chat count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error in getChatCountForShop:', error);
    return 0;
  }
};

// Delete a specific chat (for moderation if needed)
export const deleteTemporaryChatMessage = async (
  chatId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('temporary_chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      console.error('❌ Error deleting chat:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in deleteTemporaryChatMessage:', error);
    return false;
  }
};

// Format time for display
export const formatChatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleTimeString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
