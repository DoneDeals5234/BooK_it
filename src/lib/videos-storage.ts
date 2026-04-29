import {
  getAllVideosFromSupabase,
  getVideoByIdFromSupabase,
  addVideoToSupabase,
  updateVideoInSupabase,
  deleteVideoFromSupabase,
  likeVideoInSupabase,
  unlikeVideoInSupabase,
  getVideosBySearchFromSupabase,
  checkUniqueProfileNameFromSupabase,
  getVideosByUploaderIdFromSupabase,
  deleteVideoAndFileFromSupabase,
} from '@/lib/supabase-videos';

export interface Video {
  id: string;
  uploaderName: string; // Unique profile name of the uploader (shop or user)
  uploaderType: 'shop' | 'user'; // Whether the uploader is a shop or a user
  uploaderId: string; // The ID of the shop or user
  videoUrl: string;
  duration: number; // Duration in seconds (max 60)
  caption: string;
  likes: number;
  likedBy: string[]; // Array of user IDs who liked
  createdAt: Date;
}

// Get all videos from Supabase
export const getVideos = async (): Promise<Video[]> => {
  return await getAllVideosFromSupabase();
};

// Get a single video by ID
export const getVideoById = async (id: string): Promise<Video | null> => {
  return await getVideoByIdFromSupabase(id);
};

// Add a new video
export const addVideo = async (
  video: Omit<Video, 'id' | 'createdAt' | 'likes' | 'likedBy'>
): Promise<Video | null> => {
  return await addVideoToSupabase(video);
};

// Delete a video
export const deleteVideo = async (id: string): Promise<boolean> => {
  return await deleteVideoFromSupabase(id);
};

// Update a video
export const updateVideo = async (
  id: string,
  updates: Partial<Omit<Video, 'id' | 'createdAt'>>
): Promise<Video | null> => {
  return await updateVideoInSupabase(id, updates);
};

// Like a video
export const likeVideo = async (videoId: string, userId: string): Promise<boolean> => {
  return await likeVideoInSupabase(videoId, userId);
};

// Unlike a video
export const unlikeVideo = async (videoId: string, userId: string): Promise<boolean> => {
  return await unlikeVideoInSupabase(videoId, userId);
};

// Search videos by uploader profile name or shop name
export const searchVideosByProfile = async (query: string): Promise<Video[]> => {
  return await getVideosBySearchFromSupabase(query);
};

// Check if a profile name is unique (both in videos and shops)
export const checkUniqueProfileName = async (profileName: string): Promise<boolean> => {
  return await checkUniqueProfileNameFromSupabase(profileName);
};

// Get videos by uploader ID
export const getVideosByUploaderId = async (uploaderId: string): Promise<Video[]> => {
  return await getVideosByUploaderIdFromSupabase(uploaderId);
};

// Delete a video and its storage file
export const deleteVideoWithFile = async (videoId: string, videoUrl: string): Promise<boolean> => {
  return await deleteVideoAndFileFromSupabase(videoId, videoUrl);
};
