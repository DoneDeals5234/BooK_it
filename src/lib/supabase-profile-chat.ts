import { supabase } from '@/lib/supabase';

export interface ProfileChatMessage {
  id: string;
  profile_user_id: string;
  sender_name: string;
  sender_email?: string;
  sender_id?: string;
  message: string;
  created_at: string;
}

// Add a profile chat message
export const addProfileChatMessage = async (
  profileUserId: string,
  senderName: string,
  message: string,
  senderEmail?: string,
  senderId?: string
): Promise<ProfileChatMessage | null> => {
  try {
    const { data, error } = await supabase
      .from('profile_chat_messages')
      .insert({
        profile_user_id: profileUserId,
        sender_name: senderName.trim(),
        sender_email: senderEmail?.trim() || null,
        sender_id: senderId || null,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding profile chat message:', error);
      return null;
    }

    return data as ProfileChatMessage;
  } catch (error) {
    console.error('❌ Error in addProfileChatMessage:', error);
    return null;
  }
};

// Get all profile chat messages for a user
export const getProfileChatMessages = async (
  profileUserId: string,
  limit = 100
): Promise<ProfileChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('profile_chat_messages')
      .select('*')
      .eq('profile_user_id', profileUserId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching profile chat messages:', error);
      return [];
    }

    return (data || []) as ProfileChatMessage[];
  } catch (error) {
    console.error('❌ Error in getProfileChatMessages:', error);
    return [];
  }
};

// Get profile chat message count
export const getProfileChatMessageCount = async (profileUserId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('profile_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('profile_user_id', profileUserId);

    if (error) {
      console.error('❌ Error getting profile chat count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error in getProfileChatMessageCount:', error);
    return 0;
  }
};

// Delete a specific profile chat message (for moderation if needed)
export const deleteProfileChatMessage = async (
  messageId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profile_chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('❌ Error deleting profile chat message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in deleteProfileChatMessage:', error);
    return false;
  }
};

// Format time for display
export const formatProfileChatTime = (dateString: string): string => {
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
