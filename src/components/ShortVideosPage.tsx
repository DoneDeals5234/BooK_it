import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, X, Search, Eye, Upload, MapPin } from 'lucide-react';
import { getVideos, likeVideo, unlikeVideo, searchVideosByProfile } from '@/lib/videos-storage';
import type { Video } from '@/lib/videos-storage';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { PublicProfileView } from '@/components/PublicProfileView';
import { getUserProfile } from '@/lib/supabase-user-profiles';
import { getShopById } from '@/lib/shops-storage';
import toast from 'react-hot-toast';
import { CommentModal } from '@/components/CommentModal';
import { getCommentCount } from '@/lib/supabase-comments';
import { shareToInstagram, shareToWhatsApp } from '@/lib/video-share';
import './ShortVideosPage.css';

// WhatsApp Icon
const WhatsAppIcon = () => (
  <img src="/whatsapp.png" alt="WhatsApp" className="h-8 w-8 object-contain drop-shadow-md" />
);

// Instagram Icon
const InstagramIcon = () => (
  <img src="/instagram.png" alt="Instagram" className="h-8 w-8 object-contain drop-shadow-md" />
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
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const lastTapRef = useRef<number>(0);
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
        // Fetch only first 3 seconds
        video.src = videoToPreload.videoUrl + '#t=0,3';
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
  }, [videos, currentVideoIndex, isVideoPlaying]);

  const handleLocationClick = async (shopId: string) => {
    if (!window.confirm('App wants to open Google Maps')) return;
    
    try {
      toast.loading('Fetching location...', { id: 'locationFetch' });
      const shop = await getShopById(shopId);
      toast.dismiss('locationFetch');
      
      if (shop && shop.locationMapLink) {
        window.open(shop.locationMapLink, '_blank');
      } else if (shop && shop.latitude && shop.longitude) {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
        window.open(mapUrl, '_blank');
      } else {
        toast.error('Location not available for this shop.');
      }
    } catch (error) {
      toast.dismiss('locationFetch');
      toast.error('Failed to get location');
    }
  };

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
    
    // Optimistic UI Update for instant feedback
    if (isLiked) {
      setLikedVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(video.id);
        return newSet;
      });
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, likes: Math.max(0, v.likes - 1) } : v));
      // Do actual DB update in background
      unlikeVideo(video.id, currentUser.uid).catch(console.error);
    } else {
      setLikedVideos((prev) => new Set(prev).add(video.id));
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, likes: v.likes + 1 } : v));
      // Do actual DB update in background
      likeVideo(video.id, currentUser.uid).catch(console.error);
    }
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
            onClick={() => navigate('/upload-video?source=videos')}
            className="bg-primary hover:bg-primary/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload First Video
          </Button>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentVideoIndex];

  const handleVideoTap = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const currentVideo = videos[currentVideoIndex];
      if (!likedVideos.has(currentVideo.id)) {
        handleLike(currentVideo);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      lastTapRef.current = 0; // reset
    } else {
      // Single tap logic inside a timeout to allow double tap
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          // It was a single tap
          if (videoElementRef.current) {
            if (videoElementRef.current.paused) {
              videoElementRef.current.play();
              setIsVideoPlaying(true);
            } else {
              videoElementRef.current.pause();
              setIsVideoPlaying(false);
            }
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

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
        {/* PC Aspect Ratio Lock Wrapper */}
        <div className="video-player-wrapper relative w-full h-full flex flex-col items-center justify-center">
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
              onClick={handleVideoTap}
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

          {/* Heart Animation Overlay */}
          {showHeartAnimation && (
            <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
              <Heart className="h-40 w-40 text-red-500 animate-pulse fill-current drop-shadow-2xl opacity-80" />
            </div>
          )}

          {/* Video Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-transparent to-transparent p-3 sm:p-4 z-20">
            <div className="flex items-end justify-between">
              {/* Left: Uploader Info */}
              <div className="flex-1 min-w-0">
                <div 
                  className="flex items-center gap-2 mb-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  onClick={() => navigate(`/profile/${currentVideo.uploaderId}`)}
                >
                  {/* Profile Avatar */}
                  {profileImages[currentVideo.uploaderId] ? (
                    <img
                      src={profileImages[currentVideo.uploaderId]!}
                      alt={currentVideo.uploaderName}
                      className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border-2 border-white/30 flex-shrink-0 shadow-lg"
                    />
                  ) : (
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold text-white bg-gradient-to-tr from-slate-600 to-slate-800 flex-shrink-0 shadow-lg border-2 border-white/30">
                      {currentVideo.uploaderName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 drop-shadow-md">
                    <p className="text-white font-bold text-sm md:text-base truncate drop-shadow-lg">{currentVideo.uploaderName}</p>
                    {currentVideo.caption && (
                      <p className="text-white/90 text-xs md:text-sm mt-0.5 line-clamp-2 drop-shadow-md font-medium">{currentVideo.caption}</p>
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

                {/* Location Icon for Shop Owners */}
                {currentVideo.uploaderType === 'shop' && (
                  <button
                    onClick={() => handleLocationClick(currentVideo.uploaderId)}
                    className="flex flex-col items-center justify-center text-red-500 active:opacity-80 hover:opacity-80 transition-opacity p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                    title="Shop Location"
                  >
                    <MapPin className="h-6 w-6 sm:h-7 sm:w-7" />
                  </button>
                )}

                {/* Share to WhatsApp */}
                <button
                  onClick={() => {
                    if (window.confirm('App wants to open WhatsApp')) {
                      handleShareWhatsApp(currentVideo);
                    }
                  }}
                  className="flex flex-col items-center justify-center text-[#25D366] active:opacity-80 hover:opacity-80 transition-opacity p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Share on WhatsApp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </button>

                {/* Share to Instagram */}
                <button
                  onClick={() => {
                    if (window.confirm('App wants to open Instagram')) {
                      handleShareInstagram(currentVideo);
                    }
                  }}
                  className="flex flex-col items-center justify-center text-white active:opacity-80 hover:opacity-80 transition-opacity p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm"
                  title="Share on Instagram"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7" style={{ fill: 'url(#ig-gradient)' }}>
                    <defs>
                      <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f09433" />
                        <stop offset="25%" stopColor="#e6683c" />
                        <stop offset="50%" stopColor="#dc2743" />
                        <stop offset="75%" stopColor="#cc2366" />
                        <stop offset="100%" stopColor="#bc1888" />
                      </linearGradient>
                    </defs>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.98a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </button>
              </div>
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
          onCommentAdded={() => {
            setCommentCounts((prev) => ({
              ...prev,
              [currentVideo.id]: (prev[currentVideo.id] || 0) + 1,
            }));
          }}
        />
      )}
    </div>
  );
}
