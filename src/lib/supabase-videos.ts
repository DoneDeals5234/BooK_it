import { supabase } from '@/lib/supabase';
import type { Video } from '@/lib/videos-storage';
import { sendNativeNotification } from './native-notifications';

// Get all videos from Supabase, ordered by newest first
export const getAllVideosFromSupabase = async (): Promise<Video[]> => {
  const { data, error } = await supabase
    .from('videos')
    .select('id,uploader_name,uploader_type,uploader_id,video_url,duration,caption,likes,liked_by,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching videos:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    uploaderName: row.uploader_name,
    uploaderType: row.uploader_type,
    uploaderId: row.uploader_id,
    videoUrl: row.video_url,
    duration: row.duration,
    caption: row.caption,
    likes: row.likes,
    likedBy: row.liked_by || [],
    createdAt: new Date(row.created_at),
  }));
};

// Get a single video by ID
export const getVideoByIdFromSupabase = async (id: string): Promise<Video | null> => {
  const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();

  if (error) {
    console.error('Error fetching video:', error);
    return null;
  }

  return {
    id: data.id,
    uploaderName: data.uploader_name,
    uploaderType: data.uploader_type,
    uploaderId: data.uploader_id,
    videoUrl: data.video_url,
    duration: data.duration,
    caption: data.caption,
    likes: data.likes,
    likedBy: data.liked_by || [],
    createdAt: new Date(data.created_at),
  };
};

// Add a new video to Supabase
export const addVideoToSupabase = async (
  video: Omit<Video, 'id' | 'createdAt' | 'likes' | 'likedBy'>
): Promise<Video | null> => {
  // Validate video duration
  if (video.duration > 60) {
    console.error('Video duration exceeds 60 seconds');
    return null;
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      uploader_name: video.uploaderName,
      uploader_type: video.uploaderType,
      uploader_id: video.uploaderId,
      video_url: video.videoUrl,
      duration: video.duration,
      caption: video.caption,
      likes: 0,
      liked_by: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding video - Full Error Details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: JSON.stringify(error, null, 2)
    });
    throw new Error(`Database Error: ${error.message} | Code: ${error.code} | Details: ${error.details || 'N/A'}`);
  }

  return {
    id: data.id,
    uploaderName: data.uploader_name,
    uploaderType: data.uploader_type,
    uploaderId: data.uploader_id,
    videoUrl: data.video_url,
    duration: data.duration,
    caption: data.caption,
    likes: data.likes,
    likedBy: data.liked_by || [],
    createdAt: new Date(data.created_at),
  };
};

// Delete a video from Supabase
export const deleteVideoFromSupabase = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('videos').delete().eq('id', id);

  if (error) {
    console.error('Error deleting video:', error);
    return false;
  }

  return true;
};

// Update a video in Supabase
export const updateVideoInSupabase = async (
  id: string,
  updates: Partial<Omit<Video, 'id' | 'createdAt'>>
): Promise<Video | null> => {
  const updateData: Record<string, unknown> = {};

  if (updates.uploaderName !== undefined) updateData.uploader_name = updates.uploaderName;
  if (updates.uploaderType !== undefined) updateData.uploader_type = updates.uploaderType;
  if (updates.uploaderId !== undefined) updateData.uploader_id = updates.uploaderId;
  if (updates.videoUrl !== undefined) updateData.video_url = updates.videoUrl;
  if (updates.duration !== undefined) updateData.duration = updates.duration;
  if (updates.caption !== undefined) updateData.caption = updates.caption;
  if (updates.likes !== undefined) updateData.likes = updates.likes;
  if (updates.likedBy !== undefined) updateData.liked_by = updates.likedBy;

  const { data, error } = await supabase
    .from('videos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating video:', error);
    return null;
  }

  return {
    id: data.id,
    uploaderName: data.uploader_name,
    uploaderType: data.uploader_type,
    uploaderId: data.uploader_id,
    videoUrl: data.video_url,
    duration: data.duration,
    caption: data.caption,
    likes: data.likes,
    likedBy: data.liked_by || [],
    createdAt: new Date(data.created_at),
  };
};

// Like a video
export const likeVideoInSupabase = async (videoId: string, userId: string): Promise<boolean> => {
  const video = await getVideoByIdFromSupabase(videoId);
  if (!video) return false;

  if (video.likedBy.includes(userId)) {
    return true; // Already liked
  }

  const updatedLikedBy = [...video.likedBy, userId];

  const { error } = await supabase
    .from('videos')
    .update({
      likes: video.likes + 1,
      liked_by: updatedLikedBy,
    })
    .eq('id', videoId);

  if (error) {
    console.error('Error liking video:', error);
    return false;
  }

  // Notify video owner about the like
  try {
      if (video.uploaderId && video.uploaderId !== userId) {
        // Try to fetch liker's name and image
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_name, image_url')
          .eq('user_id', userId)
          .single();
        
        const likerName = profile?.profile_name || 'Someone';
        const likerImage = profile?.image_url || null;

        sendNativeNotification([video.uploaderId], {
          title: '❤️ New Like on Your Video!',
          body: `${likerName} liked your video "${video.caption?.slice(0, 20) || 'Video'}${video.caption && video.caption.length > 20 ? '...' : ''}"`,
          data: { 
            type: 'video_like', 
            video_id: videoId, 
            route: '/videos',
            imageUrl: likerImage
          }
        }).catch(console.error);
      }
  } catch (notifyErr) {
    console.warn('Failed to notify video owner about like:', notifyErr);
  }

  return true;
};

// Unlike a video
export const unlikeVideoInSupabase = async (videoId: string, userId: string): Promise<boolean> => {
  const video = await getVideoByIdFromSupabase(videoId);
  if (!video) return false;

  if (!video.likedBy.includes(userId)) {
    return true; // Not liked yet
  }

  const updatedLikedBy = video.likedBy.filter((id) => id !== userId);

  const { error } = await supabase
    .from('videos')
    .update({
      likes: Math.max(0, video.likes - 1),
      liked_by: updatedLikedBy,
    })
    .eq('id', videoId);

  if (error) {
    console.error('Error unliking video:', error);
    return false;
  }

  return true;
};

// Search videos by uploader name (shops and users)
export const getVideosBySearchFromSupabase = async (query: string): Promise<Video[]> => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .ilike('uploader_name', `%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching videos:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    uploaderName: row.uploader_name,
    uploaderType: row.uploader_type,
    uploaderId: row.uploader_id,
    videoUrl: row.video_url,
    duration: row.duration,
    caption: row.caption,
    likes: row.likes,
    likedBy: row.liked_by || [],
    createdAt: new Date(row.created_at),
  }));
};

// Check if a profile name is unique (in videos, shops, and user profiles)
export const checkUniqueProfileNameFromSupabase = async (profileName: string): Promise<boolean> => {
  try {
    const normalizedName = profileName.trim().toLowerCase();

    // Check if profile name exists in user_profiles (case-insensitive exact match)
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .filter('profile_name', 'ilike', normalizedName);

    if (profileError) {
      console.error('Error checking user profiles:', profileError);
      return true; // Return true to allow if query fails (better UX)
    }

    if (profileData && profileData.length > 0) {
      console.log('Profile name already exists in user_profiles:', normalizedName);
      return false; // Profile name already exists
    }

    // Check if profile name exists in videos (case-insensitive exact match)
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .filter('uploader_name', 'ilike', normalizedName);

    if (videoError) {
      console.error('Error checking videos:', videoError);
      return true; // Return true to allow upload if query fails (better UX)
    }

    if (videoData && videoData.length > 0) {
      console.log('Profile name already exists in videos:', normalizedName);
      return false; // Profile name already exists
    }

    // Check if profile name exists in shops (case-insensitive exact match)
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .filter('name', 'ilike', normalizedName);

    if (shopError) {
      console.error('Error checking shops:', shopError);
      return true; // Return true to allow upload if query fails (better UX)
    }

    if (shopData && shopData.length > 0) {
      console.log('Profile name already exists in shops:', normalizedName);
      return false; // Profile name already exists
    }

    return true; // Profile name is unique
  } catch (error) {
    console.error('Error checking unique profile name:', error);
    return true; // Return true on error to allow upload (better UX than blocking)
  }
};

// Get videos by uploader ID (for user's profile videos)
export const getVideosByUploaderIdFromSupabase = async (uploaderId: string): Promise<Video[]> => {
  const { data, error } = await supabase
    .from('videos')
    .select('id,uploader_name,uploader_type,uploader_id,video_url,duration,caption,likes,liked_by,created_at')
    .eq('uploader_id', uploaderId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching videos by uploader ID:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    uploaderName: row.uploader_name,
    uploaderType: row.uploader_type,
    uploaderId: row.uploader_id,
    videoUrl: row.video_url,
    duration: row.duration,
    caption: row.caption,
    likes: row.likes,
    likedBy: row.liked_by || [],
    createdAt: new Date(row.created_at),
  }));
};

// Delete a video and its storage file
export const deleteVideoAndFileFromSupabase = async (videoId: string, videoUrl: string): Promise<boolean> => {
  try {
    // Extract file path from video URL
    const urlObj = new URL(videoUrl);
    const pathSegments = urlObj.pathname.split('/');

    // The path should be like: /storage/v1/object/public/videos/videos/filename
    // We need to extract: videos/filename
    const bucketIndex = pathSegments.indexOf('videos');
    if (bucketIndex === -1) {
      console.error('Could not extract file path from video URL');
      return false;
    }

    const filePath = pathSegments.slice(bucketIndex + 1).join('/');

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('videos')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting video file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (dbError) {
      console.error('Error deleting video from database:', dbError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting video:', error);
    return false;
  }
};
