import { supabase } from '@/lib/supabase';
import { sendBroadcastNotification } from '@/lib/native-notifications';

export interface WorldChatMessage {
  id: string;
  user_name: string;
  user_email?: string;
  user_id?: string;
  message: string;
  image_url?: string;
  created_at: string;
  expires_at: string;
  profiles?: {
    image_url: string | null;
  };
}

// Add a world chat message — notify all users
export const addWorldChatMessage = async (
  userName: string,
  message: string,
  userEmail?: string,
  userId?: string,
  imageUrl?: string,
  replyTo?: string
): Promise<WorldChatMessage | null> => {
  try {
    const { data, error } = await supabase
      .from('world_chat_messages')
      .insert({
        user_name: userName.trim(),
        user_email: userEmail?.trim() || null,
        user_id: userId || null,
        message: message.trim(),
        image_url: imageUrl || null,
        reply_to: replyTo || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding world chat message:', error);
      return null;
    }

    // Notify all shop owners (non-blocking)
    if (userId) {
      const { sendWorldChatNotification } = await import('@/lib/chat-notification-system');
      sendWorldChatNotification({
        senderName: userName,
        message: message,
        senderEmail: userEmail,
        imageUrl: imageUrl,
      }).catch(console.error);
    }

    return data as WorldChatMessage;
  } catch (error) {
    console.error('❌ Error in addWorldChatMessage:', error);
    return null;
  }
};

// Get all non-expired world chat messages
export const getWorldChatMessages = async (
  limit = 20
): Promise<WorldChatMessage[]> => {
  try {
    // Fetch messages without any joins to ensure maximum stability
    const { data: messages, error: msgError } = await supabase
      .from('world_chat_messages')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (msgError) {
      console.error('❌ Error fetching world chat messages:', msgError);
      return [];
    }

    return (messages || []) as WorldChatMessage[];
  } catch (error) {
    console.error('❌ Error in getWorldChatMessages:', error);
    return [];
  }
};

// Get world chat message count
export const getWorldChatMessageCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('world_chat_messages')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('❌ Error getting world chat count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error in getWorldChatMessageCount:', error);
    return 0;
  }
};

// Delete a specific world chat message (for moderation if needed)
export const deleteWorldChatMessage = async (
  messageId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('world_chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('❌ Error deleting world chat message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in deleteWorldChatMessage:', error);
    return false;
  }
};

// Edit a world chat message
export const editWorldChatMessage = async (
  messageId: string,
  newMessage: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('world_chat_messages')
      .update({ message: newMessage.trim() })
      .eq('id', messageId);

    if (error) {
      console.error('❌ Error editing world chat message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in editWorldChatMessage:', error);
    return false;
  }
};

// Format time for display
export const formatWorldChatTime = (dateString: string): string => {
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

// Upload chat image to Supabase Storage bucket
export const uploadWorldChatImage = async (
  file: File,
  userId: string
): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log('📤 Uploading image to world-chat-images bucket...');
    const { data, error } = await supabase.storage
      .from('world-chat-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Error uploading image:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('world-chat-images')
      .getPublicUrl(filePath);

    console.log('✅ Image uploaded, URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Error in uploadWorldChatImage:', error);
    return null;
  }
};
