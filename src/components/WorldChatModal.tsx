import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, LogIn, X, AlertCircle, CheckCircle, Image as ImageIcon, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  getWorldChatMessages,
  addWorldChatMessage,
  formatWorldChatTime,
  uploadWorldChatImage,
  type WorldChatMessage,
} from '@/lib/supabase-world-chat';
import { sendWorldChatNotification } from '@/lib/chat-notification-system';
import toast from 'react-hot-toast';

interface WorldChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequired?: () => void;
}

export const WorldChatModal = ({
  isOpen,
  onClose,
  onLoginRequired,
}: WorldChatModalProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages on mount and setup polling
  useEffect(() => {
    if (isOpen) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    const fetchedMessages = await getWorldChatMessages();
    setMessages(fetchedMessages);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is logged in
    if (!user || !profile) {
      onLoginRequired?.();
      return;
    }

    if (!message.trim() && !selectedImage) {
      toast.error('Please enter a message or select an image');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | undefined = undefined;

      // Upload image if selected
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = (await uploadWorldChatImage(selectedImage, user.uid)) || undefined;
        setUploadingImage(false);

        if (selectedImage && !imageUrl) {
          toast.error('Failed to upload image. Message will be sent without image.');
        }
      }

      // Step 1: Save the message
      const newMessage = await addWorldChatMessage(
        profile.name,
        message.trim(),
        user.email || undefined,
        user.uid,
        imageUrl
      );

      if (newMessage) {
        setMessages([newMessage, ...messages]);
        setMessage('');
        removeImage();

        // Step 2: Send notification to ALL shop owners
        console.log('📤 Sending notification to all shop owners...');
        const notificationResult = await sendWorldChatNotification({
          senderName: profile.name,
          message: message.trim(),
          senderEmail: user.email || undefined,
        });

        // Show feedback to user about notification status
        if (notificationResult.success) {
          toast.success('✅ Message sent! All shop owners notified!', {
            duration: 3000,
          });
          console.log('✅ Notifications sent successfully');
        } else {
          toast.error('Message sent but notification delivery uncertain', {
            duration: 3000,
          });
          console.warn('⚠️ Notification delivery failed');
        }
      }
    } catch (error) {
      console.error('Error submitting chat:', error);
      toast.error('Failed to send message');
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  const userIsLoggedIn = !!user && !!profile;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col border-purple-200 dark:border-purple-900">
        <CardHeader className="bg-purple-50 dark:bg-purple-950 border-b border-purple-200 dark:border-purple-900 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle className="text-purple-900 dark:text-purple-100">
              World Chat
            </CardTitle>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-200 dark:hover:bg-purple-900 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4 pt-6 flex-1 overflow-hidden flex flex-col">
          <p className="text-xs text-purple-700 dark:text-purple-300">
            Chat with everyone and notify all shop owners in real-time
          </p>

          {/* Chat messages display */}
          <div
            ref={scrollRef}
            className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 flex-1 overflow-y-auto space-y-3 border border-gray-200 dark:border-slate-700"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No messages yet. Be the first to chat!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700"
                >
                  <div className="flex items-start gap-3">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {msg.user_email ? (
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: `hsl(${msg.user_email.charCodeAt(0) * 10}, 70%, 50%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          {msg.user_name[0]?.toUpperCase() || '?'}
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {msg.user_name}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300 text-sm break-words">
                        {msg.message}
                      </p>
                      {msg.image_url && (
                        <div className="mt-2 max-w-xs">
                          <img
                            src={msg.image_url}
                            alt="Chat image"
                            className="rounded-lg max-h-48 object-cover border border-gray-300 dark:border-gray-600"
                          />
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatWorldChatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input form - Show different UI based on login status */}
          {!userIsLoggedIn ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
                Login to chat and notify all shop owners
              </p>
              <Button
                onClick={onLoginRequired}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <LogIn className="h-4 w-4" />
                Login to Chat
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
              {/* User info display */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                {profile?.imageUrl ? (
                  <img
                    src={profile.imageUrl}
                    alt={profile.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: `hsl(${profile?.name?.charCodeAt(0) || 0 * 10}, 70%, 50%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {profile?.name[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {profile?.name || 'User'}
                </span>
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative max-w-xs">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="rounded-lg max-h-40 object-cover border-2 border-purple-300"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <Textarea
                placeholder="Type your message here... (max 500 characters)"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                disabled={submitting || uploadingImage}
                className="min-h-20 text-sm resize-none"
                maxLength={500}
              />

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={submitting || uploadingImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || uploadingImage}
                  className="gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  {uploadingImage ? 'Uploading...' : 'Add Image'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{message.length}/500</p>
                <Button
                  type="submit"
                  disabled={submitting || uploadingImage || (!message.trim() && !selectedImage)}
                  className="w-full gap-2"
                >
                  {submitting || uploadingImage ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send to All Shop Owners
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Info Banner */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-xs">
            <p className="text-purple-900 dark:text-purple-200">
              <strong>🌍 Global Chat:</strong> Messages here are visible to everyone and temporarily stored. They disappear daily at 1 AM. Supports text and images (max 5MB).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
