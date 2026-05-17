import { supabase } from './supabase';
import { sendNativeNotification } from './native-notifications';

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  uploaderName: string;
  uploaderImageUrl: string | null;
  commentText: string;
  createdAt: string;
  updatedAt: string;
}

// Add a new comment — notify video owner
export const addComment = async (
  videoId: string,
  userId: string,
  uploaderName: string,
  uploaderImageUrl: string | null,
  commentText: string
): Promise<Comment | null> => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        video_id: videoId,
        user_id: userId,
        uploader_name: uploaderName,
        uploader_image_url: uploaderImageUrl,
        comment_text: commentText,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return null;
    }

    // Notify the video owner (if commenter is not the owner)
    try {
      const { data: video } = await supabase
        .from('videos')
        .select('uploader_id, caption')
        .eq('id', videoId)
        .single();

      if (video?.uploader_id && video.uploader_id !== userId) {
        sendNativeNotification([video.uploader_id], {
          title: '💬 New Comment on Your Video!',
          body: `${uploaderName}: "${commentText.slice(0, 60)}${commentText.length > 60 ? '...' : ''}"`,
          data: { 
            type: 'video_comment', 
            video_id: videoId, 
            route: '/videos',
            imageUrl: uploaderImageUrl // Include image for rich notification
          }
        }).catch(console.error);
      }
    } catch (notifyErr) {
      console.warn('Failed to notify video owner about comment:', notifyErr);
    }

    return {
      id: data.id,
      videoId: data.video_id,
      userId: data.user_id,
      uploaderName: data.uploader_name,
      uploaderImageUrl: data.uploader_image_url,
      commentText: data.comment_text,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error in addComment:', error);
    return null;
  }
};

// Get comments for a video (latest first, with pagination)
export const getCommentsByVideoId = async (
  videoId: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ comments: Comment[]; total: number } | null> => {
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId);

    if (countError) {
      console.error('Error counting comments:', countError);
      return null;
    }

    // Get paginated comments (latest first)
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching comments:', error);
      return null;
    }

    const comments: Comment[] = data.map((c) => ({
      id: c.id,
      videoId: c.video_id,
      userId: c.user_id,
      uploaderName: c.uploader_name,
      uploaderImageUrl: c.uploader_image_url,
      commentText: c.comment_text,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return {
      comments,
      total: count || 0,
    };
  } catch (error) {
    console.error('Error in getCommentsByVideoId:', error);
    return null;
  }
};

// Get comment count for a video
export const getCommentCount = async (videoId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId);

    if (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getCommentCount:', error);
    return 0;
  }
};

// Delete a comment (only by the user who posted it or video owner)
export const deleteComment = async (commentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteComment:', error);
    return false;
  }
};
