import { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { addVideo } from '@/lib/videos-storage';
import { supabase } from '@/lib/supabase';
import { getUserEmailFromDevices } from '@/lib/supabase-user-devices';

interface VideoUploadModalProps {
  onClose?: () => void;
  onVideoUploaded?: () => void;
  sourceContext?: 'profile' | 'videos'; // 'profile' = Post tab, 'videos' = Videos tab
}

export const VideoUploadModal = ({ onClose, onVideoUploaded, sourceContext = 'videos' }: VideoUploadModalProps) => {
  const { user: currentUser } = useAuth();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [uploaderType, setUploaderType] = useState<'shop' | 'user'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [durationError, setDurationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize uploader name with user's email when component mounts
  useEffect(() => {
    if (sourceContext === 'videos' && currentUser?.email) {
      setUploaderName(currentUser.email);
    } else if (sourceContext === 'profile' && currentUser?.uid) {
      // For profile context, fetch email from user_devices table
      const fetchEmailFromDevices = async () => {
        const email = await getUserEmailFromDevices(currentUser.uid);
        if (email) {
          setUploaderName(email);
        }
      };
      fetchEmailFromDevices();
    }
  }, [currentUser?.email, currentUser?.uid, sourceContext]);


  // Handle video file selection
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setDurationError('');

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setVideoFile(file);

    // Get video duration
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setVideoDuration(Math.ceil(video.duration));
      if (video.duration > 60) {
        setDurationError(`Video is ${Math.ceil(video.duration)}s. Maximum duration is 60 seconds.`);
      }
    };
  };

  // Handle upload
  const handleUpload = async () => {
    if (!videoFile || !currentUser?.uid) {
      setError('Please select a video file and ensure you are logged in');
      return;
    }

    if (videoDuration > 60) {
      setError('Video exceeds 60 seconds. Please trim your video.');
      return;
    }

    // Use the uploader name (automatically fetched from user_devices for profile context)
    const finalUploaderName = uploaderName || currentUser.email;

    if (!finalUploaderName?.trim()) {
      setError('Profile name is required');
      return;
    }

    if (finalUploaderName.length < 3) {
      setError('Profile name must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      // Upload video to Supabase storage
      const fileName = `${Date.now()}-${videoFile.name}`;
      console.log('Starting video upload to storage:', fileName);

      const { data, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Special check for path error
        if (uploadError.message?.includes('relative path')) {
          const detail = JSON.stringify(uploadError);
          throw new Error(`Server Storage Config Error: ${uploadError.message}. Details: ${detail}`);
        }
        throw new Error(`Storage Error: ${uploadError.message}`);
      }

      console.log('Storage upload successful:', data);

      // Get public URL
      const { data: publicData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      const videoUrl = publicData.publicUrl;
      console.log('Video URL:', videoUrl);

      // Add video to database with storage URL
      console.log('Adding video to database:', {
        uploaderName: finalUploaderName.trim(),
        uploaderType: uploaderType,
        uploaderId: currentUser.uid,
        duration: videoDuration,
        caption: caption.trim(),
      });

      const newVideo = await addVideo({
        uploaderName: finalUploaderName.trim(),
        uploaderType: uploaderType,
        uploaderId: currentUser.uid,
        videoUrl: videoUrl,
        duration: videoDuration,
        caption: caption.trim(),
      });

      if (newVideo) {
        console.log('Video added successfully:', newVideo);
        onVideoUploaded?.();
      } else {
        console.error('Failed to save video to database');
        setError('Failed to save video to database');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Upload error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Upload Video</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Video Preview */}
          {videoPreviewUrl ? (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className="w-full h-full object-cover"
                controls
                crossOrigin="anonymous"
                preload="metadata"
              />
              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoPreviewUrl('');
                  setVideoDuration(0);
                  setDurationError('');
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">Click to select video</p>
              <p className="text-sm text-muted-foreground">Max 60 seconds</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />

          {/* Duration Info */}
          {videoDuration > 0 && (
            <div className={`p-3 rounded-lg ${durationError ? 'bg-red-100 dark:bg-red-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
              <p className={`text-sm font-medium ${durationError ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}`}>
                Duration: {videoDuration}s {durationError && ' ⚠️'}
              </p>
              {durationError && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{durationError}</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Profile Name Info - Show for videos tab to indicate it's using email */}
          {sourceContext === 'videos' && currentUser?.email && (
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Profile Name: {currentUser.email}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Your email is used as your unique profile name
              </p>
            </div>
          )}

          {/* Uploader Type - Only show if uploading from videos tab */}
          {sourceContext === 'videos' && (
            <div>
              <label className="block text-sm font-medium mb-2">Are you uploading as?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUploaderType('user')}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    uploaderType === 'user'
                      ? 'bg-primary text-white border-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  User
                </button>
                <button
                  onClick={() => setUploaderType('shop')}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    uploaderType === 'shop'
                      ? 'bg-primary text-white border-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  Shop Owner
                </button>
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium mb-1">Caption (optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption to your video..."
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !videoFile ||
              videoDuration > 60 ||
              !(uploaderName || currentUser?.email)?.trim() ||
              loading
            }
            className="flex-1"
          >
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
};
