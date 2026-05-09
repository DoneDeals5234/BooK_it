import { useState, useRef, useEffect } from 'react';
import { Upload, ArrowLeft, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { addVideo } from '@/lib/videos-storage';
import { supabase } from '@/lib/supabase';
import { getUserEmailFromDevices } from '@/lib/supabase-user-devices';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export const UploadVideoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, userRole } = useAuth();
  
  // Determine context from query param or default to 'videos'
  const searchParams = new URLSearchParams(location.search);
  const sourceContext = (searchParams.get('source') as 'profile' | 'videos') || 'videos';

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [uploaderType, setUploaderType] = useState<'shop' | 'user'>(
    sourceContext === 'profile' && userRole?.type === 'shop_owner' ? 'shop' : 'user'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [durationError, setDurationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize uploader name
  useEffect(() => {
    if (sourceContext === 'videos' && currentUser?.email) {
      setUploaderName(currentUser.email);
    } else if (sourceContext === 'profile' && currentUser?.uid) {
      const fetchEmailFromDevices = async () => {
        const email = await getUserEmailFromDevices(currentUser.uid);
        if (email) {
          setUploaderName(email);
        }
      };
      fetchEmailFromDevices();
    }
  }, [currentUser?.email, currentUser?.uid, sourceContext]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setDurationError('');

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setVideoFile(file);

    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setVideoDuration(Math.ceil(video.duration));
      if (video.duration > 60) {
        setDurationError(`Video is ${Math.ceil(video.duration)}s. Maximum duration is 60 seconds.`);
      }
    };
  };

  const handleUpload = async () => {
    if (!videoFile || !currentUser?.uid) {
      setError('Please select a video file and ensure you are logged in');
      return;
    }

    if (videoDuration > 60) {
      setError('Video exceeds 60 seconds. Please trim your video.');
      return;
    }

    const finalUploaderName = uploaderName || currentUser.email;

    if (!finalUploaderName?.trim()) {
      setError('Profile name is required');
      return;
    }

    setLoading(true);
    try {
      const fileName = `${Date.now()}-${videoFile.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      const videoUrl = publicData.publicUrl;

      const newVideo = await addVideo({
        uploaderName: finalUploaderName.trim(),
        uploaderType: uploaderType,
        uploaderId: uploaderType === 'shop' && userRole?.shopId ? userRole.shopId : currentUser.uid,
        videoUrl: videoUrl,
        duration: videoDuration,
        caption: caption.trim(),
      });

      if (newVideo) {
        toast.success('Video uploaded successfully!');
        navigate(-1);
      } else {
        setError('Failed to save video to database');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="h-6 w-6 text-slate-900" />
          </button>
          <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Upload Video</h1>
        </div>
        <Button 
          onClick={handleUpload} 
          disabled={loading || !videoFile || !!durationError}
          className="bg-red-500 hover:bg-red-600 rounded-xl font-black text-xs uppercase tracking-widest px-6"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">
        {/* Video Selector / Preview */}
        <div className="relative aspect-[9/16] max-h-[60vh] mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl group">
          {videoPreviewUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                className="w-full h-full object-contain"
                controls
              />
              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoPreviewUrl('');
                  setVideoDuration(0);
                  setDurationError('');
                }}
                className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500 transition-all"
              >
                <ArrowLeft className="h-5 w-5 rotate-45" />
              </button>
            </>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-900 transition-colors"
            >
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Upload className="h-10 w-10 text-white" />
              </div>
              <div className="text-center">
                <p className="text-white font-black uppercase tracking-widest text-sm">Select Video</p>
                <p className="text-white/50 text-xs mt-1 font-bold">MP4, MOV or AVI (Max 60s)</p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />

        {/* Validation Errors */}
        {durationError && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{durationError}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {/* Settings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's on your mind?..."
              className="w-full bg-slate-50 rounded-2xl p-4 border-none focus:ring-2 focus:ring-red-500 outline-none font-medium min-h-[100px] resize-none"
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-50">
            <label className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Posting as</label>
            <div className="flex gap-3">
              <button
                onClick={() => setUploaderType('user')}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${
                  uploaderType === 'user' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200' 
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => setUploaderType('shop')}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${
                  uploaderType === 'shop' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200' 
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                }`}
              >
                Shop Owner
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Check className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Account Verified</p>
              <p className="text-sm font-bold text-slate-900">{uploaderName || currentUser?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadVideoPage;
