import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, StopCircle, RefreshCw, Check, X, Video, Play, Pause } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';

interface VideoRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  maxDuration?: number; // In seconds
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  isOpen,
  onClose,
  onSave,
  maxDuration = 60,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }

    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraReady(true);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraReady(false);
  };

  const resetState = () => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    setError(null);
    chunksRef.current = [];
  };

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    // Check for supported mime types
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    
    let selectedType = '';
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedType = type;
        break;
      }
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, selectedType ? { mimeType: selectedType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedType || 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      setError('Failed to start recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob);
      onClose();
    }
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    startCamera();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-black text-white border-none p-0 overflow-hidden">
        <DialogHeader className="p-4 bg-zinc-900 border-b border-zinc-800">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            Record Shop Interior
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-center p-6">
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="outline" onClick={startCamera} className="border-zinc-700 hover:bg-zinc-800 text-white">
                Try Again
              </Button>
            </div>
          ) : recordedBlob && previewUrl ? (
            <video 
              src={previewUrl} 
              className="w-full h-full object-contain" 
              controls 
              autoPlay
            />
          ) : (
            <>
              <video 
                ref={videoRef} 
                className={`w-full h-full object-cover ${!isCameraReady ? 'hidden' : ''}`}
                autoPlay 
                muted 
                playsInline 
              />
              {!isCameraReady && (
                <div className="flex flex-col items-center gap-2">
                  <Spinner className="w-8 h-8 text-white" />
                  <p className="text-sm text-zinc-400">Initializing camera...</p>
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-4 right-4 w-32">
                  <Progress value={(recordingTime / maxDuration) * 100} className="h-1 bg-white/20" />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-4">
          {!recordedBlob ? (
            <>
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                Cancel
              </Button>
              
              {!isRecording ? (
                <Button 
                  onClick={startRecording}
                  disabled={!isCameraReady}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full px-8 py-6 h-auto flex gap-2 items-center"
                >
                  <div className="w-4 h-4 rounded-full bg-white" />
                  Start Recording
                </Button>
              ) : (
                <Button 
                  onClick={stopRecording}
                  className="bg-white hover:bg-zinc-200 text-black rounded-full px-8 py-6 h-auto flex gap-2 items-center"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </Button>
              )}
              
              <div className="w-20" /> {/* Spacer */}
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={handleRetake}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 flex gap-2 items-center"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </Button>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="border-zinc-700 text-white hover:bg-zinc-800"
                >
                  Discard
                </Button>
                <Button 
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white flex gap-2 items-center"
                >
                  <Check className="w-4 h-4" />
                  Use Video
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
