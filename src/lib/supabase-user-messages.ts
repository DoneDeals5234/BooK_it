import { supabase } from './supabase';

export interface UserMessage {
  id: string;
  userId: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  messageType: 'thought' | 'support' | 'feedback';
  adminReply?: string;
  adminReplyBy?: string;
  isRead: boolean;
  replyDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const sendUserMessage = async (
  userId: string,
  senderName: string,
  senderEmail: string,
  message: string,
  messageType: 'thought' | 'support' | 'feedback' = 'thought',
  senderPhone?: string
): Promise<UserMessage> => {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .insert({
        user_id: userId,
        sender_name: senderName,
        sender_email: senderEmail,
        sender_phone: senderPhone || null,
        message,
        message_type: messageType,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      senderName: data.sender_name,
      senderEmail: data.sender_email,
      senderPhone: data.sender_phone,
      message: data.message,
      messageType: data.message_type,
      adminReply: data.admin_reply,
      adminReplyBy: data.admin_reply_by,
      isRead: data.is_read,
      replyDate: data.reply_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error sending message:', errorMessage);
    throw new Error(`Failed to send message: ${errorMessage}`);
  }
};

export const getUserMessages = async (userId: string): Promise<UserMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      id: msg.id,
      userId: msg.user_id,
      senderName: msg.sender_name,
      senderEmail: msg.sender_email,
      senderPhone: msg.sender_phone,
      message: msg.message,
      messageType: msg.message_type,
      adminReply: msg.admin_reply,
      adminReplyBy: msg.admin_reply_by,
      isRead: msg.is_read,
      replyDate: msg.reply_date,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error fetching user messages:', errorMessage);
    throw new Error(`Failed to fetch user messages: ${errorMessage}`);
  }
};

export const getAllMessages = async (): Promise<UserMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      id: msg.id,
      userId: msg.user_id,
      senderName: msg.sender_name,
      senderEmail: msg.sender_email,
      senderPhone: msg.sender_phone,
      message: msg.message,
      messageType: msg.message_type,
      adminReply: msg.admin_reply,
      adminReplyBy: msg.admin_reply_by,
      isRead: msg.is_read,
      replyDate: msg.reply_date,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error fetching all messages:', errorMessage);
    throw new Error(`Failed to fetch all messages: ${errorMessage}`);
  }
};

export const replyToMessage = async (
  messageId: string,
  adminReply: string,
  adminReplyBy: string
): Promise<UserMessage> => {
  try {
    const { data, error } = await supabase
      .from('user_messages')
      .update({
        admin_reply: adminReply,
        admin_reply_by: adminReplyBy,
        is_read: true,
        reply_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      senderName: data.sender_name,
      senderEmail: data.sender_email,
      senderPhone: data.sender_phone,
      message: data.message,
      messageType: data.message_type,
      adminReply: data.admin_reply,
      adminReplyBy: data.admin_reply_by,
      isRead: data.is_read,
      replyDate: data.reply_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error replying to message:', errorMessage);
    throw new Error(`Failed to reply to message: ${errorMessage}`);
  }
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) throw error;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error marking message as read:', errorMessage);
    throw new Error(`Failed to mark message as read: ${errorMessage}`);
  }
};

export const getUnreadMessageCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('user_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error fetching unread count:', errorMessage);
    return 0;
  }
};
