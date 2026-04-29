import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, LogIn, X, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  getProfileChatMessages,
  addProfileChatMessage,
  formatProfileChatTime,
  type ProfileChatMessage,
} from '@/lib/supabase-profile-chat';
import { sendProfileChatNotification } from '@/lib/chat-notification-system';
import toast from 'react-hot-toast';

interface ProfileChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUserId: string;
  profileUserName: string;
  profileUserEmail?: string;
  onLoginRequired?: () => void;
}

export const ProfileChatModal = ({
  isOpen,
  onClose,
  profileUserId,
  profileUserName,
  profileUserEmail,
  onLoginRequired,
}: ProfileChatModalProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<ProfileChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages on mount and setup polling
  useEffect(() => {
    if (isOpen) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, profileUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    const fetchedMessages = await getProfileChatMessages(profileUserId);
    setMessages(fetchedMessages);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is logged in
    if (!user || !profile) {
      onLoginRequired?.();
      return;
    }

    if (!message.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Save the message
      const newMessage = await addProfileChatMessage(
        profileUserId,
        profile.name,
        message,
        user.email || undefined,
        user.uid
      );

      if (newMessage) {
        setMessages([newMessage, ...messages]);
        setMessage('');

        // Step 2: Send notification to profile owner
        console.log('📤 Sending notification to profile owner...');
        const notificationResult = await sendProfileChatNotification({
          profileUserId,
          senderName: profile.name,
          message: message.trim(),
          senderEmail: user.email || undefined,
        });

        // Show feedback to user about notification status
        if (notificationResult.success) {
          toast.success('✅ Message sent!', {
            duration: 3000,
          });
          console.log('✅ Notification sent successfully');
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
    }
  };

  const userIsLoggedIn = !!user && !!profile;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col border-green-200 dark:border-green-900">
        <CardHeader className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-900 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle className="text-green-900 dark:text-green-100">
                Chat with {profileUserName}
              </CardTitle>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                Send a message to this user
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-200 dark:hover:bg-green-900 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4 pt-6 flex-1 overflow-hidden flex flex-col">
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
                No messages yet. Be the first to message!
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
                      {msg.sender_email ? (
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: `hsl(${msg.sender_email.charCodeAt(0) * 10}, 70%, 50%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          {msg.sender_name[0]?.toUpperCase() || '?'}
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {msg.sender_name}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300 text-sm break-words">
                        {msg.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatProfileChatTime(msg.created_at)}
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
                Login to send messages
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

              <Textarea
                placeholder="Type your message here... (max 500 characters)"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                disabled={submitting}
                className="min-h-20 text-sm resize-none"
                maxLength={500}
              />

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{message.length}/500</p>
                <Button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="w-full gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Info Banner */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs">
            <p className="text-green-900 dark:text-green-200">
              <strong>💬 Direct Message:</strong> Send a direct message to {profileUserName}. They will be notified of your message.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
