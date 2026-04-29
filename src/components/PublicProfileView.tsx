import { useState, useEffect } from 'react';
import { X, Heart } from 'lucide-react';
import { getVideos, likeVideo, unlikeVideo } from '@/lib/videos-storage';
import type { Video } from '@/lib/videos-storage';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface PublicProfileViewProps {
  profileName: string;
  onClose: () => void;
}

export const PublicProfileView = ({ profileName, onClose }: PublicProfileViewProps) => {
  const { user: currentUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [profileImage, setProfileImage] = useState<string>('');
  const [uploaderName, setUploaderName] = useState<string>(profileName);

  useEffect(() => {
    loadProfileVideos();
  }, [profileName]);

  const loadProfileVideos = async () => {
    try {
      setLoading(true);
      // Get all videos and filter by uploader name (case-insensitive)
      const allVideos = await getVideos();
      const profileVideos = allVideos.filter(
        (v) => v.uploaderName.toLowerCase() === profileName.toLowerCase()
      );
      
      setVideos(profileVideos);
      setUploaderName(profileVideos.length > 0 ? profileVideos[0].uploaderName : profileName);

      // Set up liked videos
      if (currentUser?.uid) {
        const liked = new Set(
          profileVideos
            .filter((v) => v.likedBy.includes(currentUser.uid))
            .map((v) => v.id)
        );
        setLikedVideos(liked);
      }
    } catch (error) {
      console.error('Error loading profile videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (video: Video) => {
    if (!currentUser?.uid) {
      toast.error('Please log in to like videos');
      return;
    }

    const isLiked = likedVideos.has(video.id);
    if (isLiked) {
      await unlikeVideo(video.id, currentUser.uid);
      setLikedVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(video.id);
        return newSet;
      });
    } else {
      await likeVideo(video.id, currentUser.uid);
      setLikedVideos((prev) => new Set(prev).add(video.id));
    }

    // Refresh videos to get updated like count
    const updated = await getVideos();
    const profileVideos = updated.filter(
      (v) => v.uploaderName.toLowerCase() === profileName.toLowerCase()
    );
    setVideos(profileVideos);
  };

  const getBackgroundColor = (letter: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const firstLetter = uploaderName?.[0]?.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{uploaderName}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
          ) : (
            <>
              {/* Profile Section */}
              <div className="flex flex-col items-center gap-4 pb-4 border-b border-border">
                <div>
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={uploaderName}
                      className="h-24 w-24 rounded-full object-cover border-4 border-primary"
                    />
                  ) : (
                    <div
                      className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-white ${getBackgroundColor(
                        firstLetter
                      )} border-4 border-primary`}
                    >
                      {firstLetter}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{uploaderName}</h3>
                  <p className="text-sm text-muted-foreground">{videos.length} videos</p>
                </div>
              </div>

              {/* Videos Section */}
              {videos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No videos yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {videos.map((video) => (
                    <div key={video.id} className="space-y-2">
                      <div className="relative group bg-black rounded-lg overflow-hidden aspect-video">
                        <video
                          src={video.videoUrl}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleLike(video)}
                            className="flex items-center gap-1 text-white active:text-red-500 hover:text-red-500 transition-colors pointer-events-auto touch-action-auto p-2 -m-2 rounded-lg"
                          >
                            <Heart
                              className="h-6 w-6"
                              fill={likedVideos.has(video.id) ? 'currentColor' : 'none'}
                              color={likedVideos.has(video.id) ? 'red' : 'white'}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {video.caption && (
                          <p className="text-sm font-medium truncate">{video.caption}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {video.likes} likes • {video.duration}s
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
