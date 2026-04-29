import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCameraCapture } from '@/lib/use-camera-capture';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (file: File) => void;
  imageType?: string;
  title?: string;
}

export const ImageUploadModal = ({
  isOpen,
  onClose,
  onImageSelected,
  imageType = 'image',
  title = 'Add Image',
}: ImageUploadModalProps) => {
  const [loading, setLoading] = useState(false);
  const { capturePhoto } = useCameraCapture();

  if (!isOpen) return null;

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('File size must be less than 5MB');
          return;
        }
        onImageSelected(file);
        onClose();
      }
    };
    input.click();
  };

  const handleCameraClick = async () => {
    setLoading(true);
    try {
      const photo = await capturePhoto();
      if (photo) {
        // Convert base64 to File
        const base64String = photo.webPath || '';
        const byteCharacters = atob(base64String.split(',')[1] || base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });

        onImageSelected(file);
        onClose();
        toast.success('Photo captured successfully!');
      }
    } catch (error: any) {
      console.error('Camera capture error:', error);
      toast.error(error.message || 'Failed to capture photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose how you'd like to add your {imageType}
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Upload from Device */}
            <Button
              onClick={handleUploadClick}
              disabled={loading}
              className="h-24 flex flex-col items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm font-medium">Upload from Device</span>
              <span className="text-xs opacity-90">Select from gallery</span>
            </Button>

            {/* Capture from Camera */}
            <Button
              onClick={handleCameraClick}
              disabled={loading}
              className="h-24 flex flex-col items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Opening Camera...</span>
                </>
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <span className="text-sm font-medium">Capture from Camera</span>
                  <span className="text-xs opacity-90">Take a photo</span>
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
