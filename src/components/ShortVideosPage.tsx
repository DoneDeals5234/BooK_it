import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, X, Search, Eye, Upload } from 'lucide-react';
import { getVideos, likeVideo, unlikeVideo, searchVideosByProfile } from '@/lib/videos-storage';
import type { Video } from '@/lib/videos-storage';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { PublicProfileView } from '@/components/PublicProfileView';
import { getUserProfile } from '@/lib/supabase-user-profiles';
import { CommentModal } from '@/components/CommentModal';
import { getCommentCount } from '@/lib/supabase-comments';
import { shareToInstagram, shareToWhatsApp } from '@/lib/video-share';
import { VideoUploadModal } from '@/components/VideoUploadModal';
import './ShortVideosPage.css';

// WhatsApp Icon
const WhatsAppIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.935 1.188L5.031 3.04 6.251 8.735a9.857 9.857 0 001.435 4.873 9.832 9.832 0 004.293 3.563l4.303-.215a9.82 9.82 0 004.85-1.43l2.47 1.427-1.341-4.281a9.86 9.86 0 00.744-4.916 9.86 9.86 0 00-9.06-8.847z"/>
  </svg>
);

// Instagram Icon
const InstagramIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#instagramGradient)"/>
    <defs>
      <linearGradient id="instagramGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" style={{stopColor: '#feda75', stopOpacity: 1}} />
        <stop offset="5%" style={{stopColor: '#fa7e1e', stopOpacity: 1}} />
        <stop offset="45%" style={{stopColor: '#d92e7f', stopOpacity: 1}} />
        <stop offset="60%" style={{stopColor: '#9b36b7', stopOpacity: 1}} />
        <stop offset="90%" style={{stopColor: '#515bd4', stopOpacity: 1}} />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="3.5" fill="white"/>
    <circle cx="17.5" cy="6.5" r="1.5" fill="white"/>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="white" strokeWidth="1.5"/>
  </svg>
);

interface ShortVideosPageProps {
  onClose: () => void;
}

export default function ShortVideosPage({ onClose }: ShortVideosPageProps) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [showProfileView, setShowProfileView] = useState(false);
  const [selectedProfileName, setSelectedProfileName] = useState<string>('');
  const [profileImages, setProfileImages] = useState<Record<string, string | null>>({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const preloadedVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const { user: currentUser } = useAuth();

  // Load initial videos with smart preloading
  useEffect(() => {
    const loadVideos = async () => {
      try {
        const videosData = await getVideos();
        setVideos(videosData);

        // Preload current and adjacent videos for smooth playback
        const preloadVideo = (videoUrl: string) => {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'video';
          link.href = videoUrl;
          document.head.appendChild(link);
        };

        // Preload current video and next 2 videos
        for (let i = 0; i < Math.min(3, videosData.length); i++) {
          if (videosData[i]?.videoUrl) {
            preloadVideo(videosData[i].videoUrl);
          }
        }

        // Fetch profile images for all unique uploaders
        const uniqueUploaderIds = Array.from(
          new Set(videosData.map((v) => v.uploaderId).filter(Boolean))
        );

        const imagesMap: Record<string, string | null> = {};
        await Promise.all(
          uniqueUploaderIds.map(async (id) => {
            try {
              const profile = await getUserProfile(id);
              imagesMap[id] = profile?.imageUrl || null;
            } catch (err) {
              console.error('Error loading profile image for user:', id, err);
              imagesMap[id] = null;
            }
          })
        );
        setProfileImages(imagesMap);

        if (currentUser?.uid) {
          const liked = new Set(
            videosData
              .filter((v) => v.likedBy.includes(currentUser.uid))
              .map((v) => v.id)
          );
          setLikedVideos(liked);
        }

        // Load comment counts for all videos
        const counts: Record<string, number> = {};
        await Promise.all(
          videosData.map(async (video) => {
            try {
              const count = await getCommentCount(video.id);
              counts[video.id] = count;
            } catch (err) {
              console.error('Error loading comment count for video:', video.id, err);
              counts[video.id] = 0;
            }
          })
        );
        setCommentCounts(counts);
      } catch (error) {
        console.error('Error loading videos:', error);
      }
      setLoading(false);
    };

    loadVideos();

    // Set up real-time subscription for videos
    const videosSubscription = supabase
      .channel('videos-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
        },
        () => {
          getVideos().then((updated) => {
            setVideos(updated);
          });
        }
      )
      .subscribe();

    // Set up real-time subscription for comments
    const commentsSubscription = supabase
      .channel('comments-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const videoId = payload.new.video_id;
          setCommentCounts((prev) => ({
            ...prev,
            [videoId]: (prev[videoId] || 0) + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const videoId = payload.old.video_id;
          setCommentCounts((prev) => ({
            ...prev,
            [videoId]: Math.max(0, (prev[videoId] || 0) - 1),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(videosSubscription);
      supabase.removeChannel(commentsSubscription);
    };
  }, [currentUser?.uid]);

  // Aggressive preload: next 3 videos
  useEffect(() => {
    if (videos.length === 0) return;

    const preloadNextVideos = () => {
      // Preload next 3 videos
      for (let i = 1; i <= 3 && i < videos.length; i++) {
        const preloadIndex = (currentVideoIndex + i) % videos.length;
        const videoToPreload = videos[preloadIndex];

        // Skip if already preloaded
        if (preloadedVideosRef.current.has(videoToPreload.id)) {
          continue;
        }

        const video = document.createElement('video');
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.src = videoToPreload.videoUrl;
        video.style.display = 'none';
        document.body.appendChild(video);

        // Store in map for reuse
        preloadedVideosRef.current.set(videoToPreload.id, video);
      }

      // Cleanup old preloads (keep only next 3)
      const idsToKeep = new Set<string>();
      for (let i = 0; i <= 3 && i < videos.length; i++) {
        const index = (currentVideoIndex + i) % videos.length;
        idsToKeep.add(videos[index].id);
      }

      preloadedVideosRef.current.forEach((video, id) => {
        if (!idsToKeep.has(id)) {
          document.body.removeChild(video);
          preloadedVideosRef.current.delete(id);
        }
      });
    };

    preloadNextVideos();
  }, [currentVideoIndex, videos]);

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      const videosData = await getVideos();
      setVideos(videosData);
      setSearchResults([]);
    } else {
      const results = await searchVideosByProfile(query);
      setSearchResults(results);
    }
  };

  // Smooth scrolling state with requestAnimationFrame
  const isAnimatingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const touchVelocityRef = useRef(0);
  const lastSwipeIndexRef = useRef(-1);
  const animationFrameRef = useRef<number | null>(null);

  // Handle wheel scroll - VERTICAL SCROLLING (minimal threshold)
  const handleWheel = (e: WheelEvent) => {
    if (isAnimatingRef.current) return;

    // Use deltaY for vertical scrolling
    const scrollDelta = e.deltaY;

    // Minimal threshold: any significant scroll triggers video change
    if (Math.abs(scrollDelta) > 15) {
      isAnimatingRef.current = true;

      if (scrollDelta > 0) {
        // Scroll down - next video
        setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
      } else {
        // Scroll up - previous video
        setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length);
      }

      // Allow next scroll after animation completes
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 400);
    }
  };

  // Handle touch swipe - VERTICAL SWIPING ONLY with smooth transitions
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimatingRef.current) return;

    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
    touchVelocityRef.current = 0;

    // Cancel any ongoing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isAnimatingRef.current) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - touchStartTimeRef.current;
    const verticalDiff = touchStartYRef.current - touchEndY;

    // Minimal swipe threshold (30px) - VERTICAL ONLY
    const SWIPE_THRESHOLD = 30;

    // Calculate velocity (for momentum dampening)
    if (touchDuration > 0) {
      touchVelocityRef.current = Math.abs(verticalDiff) / touchDuration;
    }

    // Only trigger video change on VERTICAL swipe (ignore horizontal)
    if (Math.abs(verticalDiff) > SWIPE_THRESHOLD) {
      isAnimatingRef.current = true;
      let newIndex = currentVideoIndex;

      if (verticalDiff > 0) {
        // Swipe up - next video
        newIndex = (currentVideoIndex + 1) % videos.length;
      } else {
        // Swipe down - previous video
        newIndex = (currentVideoIndex - 1 + videos.length) % videos.length;
      }

      lastSwipeIndexRef.current = newIndex;
      setCurrentVideoIndex(newIndex);

      // Smooth animation duration with momentum dampening
      const animationDuration = Math.max(200, Math.min(400, 500 - touchVelocityRef.current * 100));

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, animationDuration);
    }
  };

  // Handle like button
  const handleLike = async (video: Video) => {
    if (!currentUser?.uid) return;

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
    setVideos(updated);
  };

  // Share to WhatsApp
  const handleShareWhatsApp = async (video: Video) => {
    try {
      await shareToWhatsApp({
        videoUrl: video.videoUrl,
        title: `Video by ${video.uploaderName}`,
        text: video.caption || `Check out this video from ${video.uploaderName}!`,
      });
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      alert('Error sharing video to WhatsApp');
    }
  };

  // Share to Instagram
  const handleShareInstagram = async (video: Video) => {
    try {
      await shareToInstagram({
        videoUrl: video.videoUrl,
        title: `Video by ${video.uploaderName}`,
        text: video.caption || `Check out this video from ${video.uploaderName}!`,
      });
    } catch (error) {
      console.error('Error sharing to Instagram:', error);
      alert('Error sharing video to Instagram. Make sure Instagram is installed.');
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
        <X
          className="h-6 w-6 text-white absolute top-4 right-4 cursor-pointer"
          onClick={() => navigate(-1)}
        />
        <div className="text-center">
          <p className="text-white text-lg mb-4">No videos yet</p>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload First Video
          </Button>
        </div>
        {showUploadModal && (
          <VideoUploadModal
            onClose={() => setShowUploadModal(false)}
            onVideoUploaded={() => {
              setShowUploadModal(false);
              // Reload videos
              getVideos().then(setVideos);
            }}
          />
        )}
      </div>
    );
  }

  const currentVideo = videos[currentVideoIndex];

  return (
    <div
      className="min-h-screen bg-black relative overflow-hidden touch-none"
      style={{ touchAction: 'none' }}
      ref={videoContainerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Search Bar */}
      {showSearch && (
        <div className="absolute top-20 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm p-4 max-h-[70vh] overflow-y-auto">
          <div className="relative max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/50" />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary border-0"
                autoFocus
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {/* Get unique profile names from search results */}
                {Array.from(
                  new Set(searchResults.map((v) => v.uploaderName))
                ).map((profileName) => {
                  const profileVideos = searchResults.filter((v) => v.uploaderName === profileName);
                  return (
                    <div
                      key={profileName}
                      className="bg-white/10 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-white font-medium">{profileName}</p>
                        <p className="text-white/70 text-sm">{profileVideos.length} videos</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProfileName(profileName);
                          setShowProfileView(true);
                          setShowSearch(false);
                        }}
                        className="bg-primary hover:bg-primary/90 text-white rounded px-3 py-1 flex items-center gap-1 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View Profile
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <p className="text-center text-white/70 text-sm">No profiles found</p>
            )}
          </div>
        </div>
      )}

      {/* Vertical Video Container - Smooth Snap Scrolling Up/Down */}
      <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
        {/* Current Video - Full Screen */}
        <div className="relative w-full h-full transition-opacity duration-300">
          <video
            ref={videoElementRef}
            key={currentVideo.id}
            src={currentVideo.videoUrl}
            className="w-full h-full object-cover cursor-pointer"
            style={{ willChange: 'transform' }}
            autoPlay={isVideoPlaying}
            loop
            muted={false}
            controls={false}
            crossOrigin="anonymous"
            preload="auto"
            onClick={() => {
              // Single tap to toggle play/pause
              if (videoElementRef.current) {
                if (videoElementRef.current.paused) {
                  videoElementRef.current.play();
                  setIsVideoPlaying(true);
                } else {
                  videoElementRef.current.pause();
                  setIsVideoPlaying(false);
                }
              }
            }}
            onError={(e) => {
              console.error('❌ Video playback error:', {
                src: currentVideo.videoUrl,
                error: e.currentTarget.error?.message,
                code: e.currentTarget.error?.code,
              });
              setIsVideoLoading(false);
            }}
            onLoadStart={() => {
              console.log('📹 Video loading started:', currentVideo.videoUrl);
              setIsVideoLoading(true);
            }}
            onCanPlay={() => {
              console.log('✅ Video can play');
              setIsVideoLoading(false);
            }}
          />

          {/* Loading Spinner */}
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 animate-fadeIn">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                <p className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-2 text-white text-xs whitespace-nowrap">
                  Loading...
                </p>
              </div>
            </div>
          )}

          {/* Video Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-transparent to-transparent p-3 sm:p-4 z-20">
            <div className="flex items-end justify-between">
              {/* Left: Uploader Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {/* Profile Avatar */}
                  {profileImages[currentVideo.uploaderId] ? (
                    <img
                      src={profileImages[currentVideo.uploaderId]!}
                      alt={currentVideo.uploaderName}
                      className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border-2 border-white/30 flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold text-white bg-gray-600 flex-shrink-0">
                      {currentVideo.uploaderName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm md:text-base truncate">{currentVideo.uploaderName}</p>
                    {currentVideo.caption && (
                      <p className="text-white/80 text-xs md:text-sm mt-0.5 line-clamp-2">{currentVideo.caption}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Action Buttons (Vertical Stack) - Circular icons fitting the side area */}
              <div className="fixed right-4 bottom-24 sm:bottom-32 flex flex-col gap-4 z-30">
                {/* Like Button */}
                <button
                  onClick={() => handleLike(currentVideo)}
                  className="flex flex-col items-center justify-center gap-1 text-white active:text-red-500 hover:text-red-500 transition-colors p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Like"
                >
                  <Heart
                    className="h-6 w-6 sm:h-7 sm:w-7"
                    fill={likedVideos.has(currentVideo.id) ? 'currentColor' : 'none'}
                    color={likedVideos.has(currentVideo.id) ? 'red' : 'white'}
                  />
                  <span className="text-xs font-bold">{currentVideo.likes}</span>
                </button>

                {/* Comment Button */}
                <button
                  onClick={() => setShowCommentModal(true)}
                  className="flex flex-col items-center justify-center gap-1 text-white active:text-blue-500 hover:text-blue-500 transition-colors p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Comment"
                >
                  <MessageSquare className="h-6 w-6 sm:h-7 sm:w-7" />
                  <span className="text-xs font-bold">{commentCounts[currentVideo.id] || 0}</span>
                </button>

                {/* Share to WhatsApp */}
                <button
                  onClick={() => handleShareWhatsApp(currentVideo)}
                  className="flex flex-col items-center justify-center text-[#25D366] active:opacity-80 hover:opacity-80 transition-opacity p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Share on WhatsApp"
                >
                  <WhatsAppIcon />
                </button>

                {/* Share to Instagram */}
                <button
                  onClick={() => handleShareInstagram(currentVideo)}
                  className="flex flex-col items-center justify-center active:opacity-80 hover:opacity-80 transition-opacity p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Share on Instagram"
                >
                  <InstagramIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Profile View Modal */}
      {showProfileView && (
        <PublicProfileView
          profileName={selectedProfileName}
          onClose={() => setShowProfileView(false)}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          videoId={currentVideo.id}
          onClose={() => setShowCommentModal(false)}
        />
      )}
    </div>
  );
};
