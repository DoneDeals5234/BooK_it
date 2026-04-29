import { useState, useRef } from 'react';
import { X, Upload, Send, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { diagnoseNotificationSetup } from '@/lib/notification-diagnostic';
import { uploadNotificationImage } from '@/lib/notification-storage';

interface CustomNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomNotificationModal = ({ isOpen, onClose }: CustomNotificationModalProps) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file',
          description: 'Please select an image file',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Image must be less than 20MB',
          variant: 'destructive',
        });
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      console.log('📸 Image selected:', {
        name: file.name,
        size: `${(file.size / 1024).toFixed(2)}KB`,
        type: file.type,
      });

      toast({
        title: 'Image selected',
        description: `${file.name} - Will be uploaded when you send`,
      });
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in both title and message',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUser?.uid) {
      toast({
        title: 'Not authenticated',
        description: 'You must be logged in to send notifications',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Build the notification payload
      const payload: Record<string, any> = {
        user_ids: [currentUser.uid],
        title: title.trim(),
        body: message.trim(),
      };

      // Upload image to Supabase Storage if provided
      let imageUrl: string | null = null;
      if (imageFile && imagePreview) {
        console.log('📤 Uploading image to Supabase Storage...');
        setIsUploadingImage(true);
        try {
          imageUrl = await uploadNotificationImage(imageFile);
          console.log('✅ Image uploaded, public URL:', imageUrl);

          // Add image to payload using big_picture field (OneSignal standard)
          payload.big_picture = imageUrl;
          payload.image = imageUrl; // Also add to image field for compatibility

          toast({
            title: 'Image uploaded',
            description: 'Now sending notification...',
          });
        } catch (error) {
          console.error('❌ Image upload failed:', error);
          toast({
            title: 'Image upload failed',
            description: error instanceof Error ? error.message : 'Could not upload image',
            variant: 'destructive',
          });
          setIsLoading(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      console.log('📤 Sending custom notification with payload:', {
        title: payload.title,
        body: payload.body,
        hasImage: !!payload.big_picture,
        imageUrl: payload.big_picture || 'none',
        userId: currentUser.uid,
      });

      // Get the session from Supabase (same pattern as existing code)
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token 
        ? `Bearer ${session.access_token}` 
        : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

      console.log('🔐 Using auth header:', !!session?.access_token ? 'User session token' : 'Anon key');

      // Run diagnostics
      console.log('🔍 Running notification setup diagnostics...');
      const diagnostics = await diagnoseNotificationSetup(currentUser.uid);
      if (diagnostics.errors.length > 0) {
        console.warn('⚠️ Diagnostic warnings:', diagnostics.errors);
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-by-userid`;
      console.log('📍 Calling function:', functionUrl);
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      // Use text() first to handle any response type
      const responseText = await response.text();
      console.log('📋 Response text:', responseText);

      if (!response.ok) {
        console.error('❌ Notification send failed:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
        });
        toast({
          title: 'Failed to send notification',
          description: `HTTP ${response.status}: ${responseText.substring(0, 100)}`,
          variant: 'destructive',
        });
        return;
      }

      // Try to parse response as JSON if ok
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }

      console.log('✅ Notification sent successfully:', data);
      toast({
        title: 'Notification sent!',
        description: imageUrl 
          ? 'Your notification with image has been sent to your device' 
          : 'Your custom notification has been sent to your device',
      });

      // Reset form
      setTitle('');
      setMessage('');
      setImageFile(null);
      setImagePreview('');
      onClose();
    } catch (error) {
      console.error('❌ Error sending notification:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send notification';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsUploadingImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b border-border bg-white dark:bg-slate-900">
          <h2 className="text-lg sm:text-xl font-semibold">Send Custom Notification</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notification Title *
            </label>
            <input
              type="text"
              placeholder="e.g., Special Offer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Message Body *
            </label>
            <textarea
              placeholder="e.g., Get 30% off on all haircuts this weekend!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={4}
              className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{message.length}/500</p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notification Image (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={isLoading || isUploadingImage}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploadingImage}
              className="w-full border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
            >
              {isUploadingImage ? (
                <>
                  <Loader className="h-5 w-5 text-muted-foreground animate-spin" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {imageFile ? imageFile.name : 'Click to upload image'}
                  </span>
                </>
              )}
            </button>

            {/* Image Preview */}
            {imagePreview && !isUploadingImage && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <div className="relative w-full bg-muted rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-auto max-h-48 object-contain"
                  />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={isLoading || isUploadingImage}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info Message */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs text-foreground">
            <p className="font-semibold mb-1">💡 Testing Mode</p>
            <p>This notification will be sent only to you (admin) for testing purposes.</p>
          </div>

          {/* Image Upload Info */}
          <div className="bg-blue/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-foreground">
            <p className="font-semibold mb-1">📸 Image Info</p>
            <p>Images will be uploaded to Supabase Storage and sent as a large picture in the notification (same as the OneSignal example you showed).</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 p-4 sm:p-6 border-t border-border bg-white dark:bg-slate-900">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isUploadingImage}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendNotification}
            disabled={isLoading || isUploadingImage || !title.trim() || !message.trim()}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isLoading || isUploadingImage ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                {isUploadingImage ? 'Uploading...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to Me
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
