import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  getChatsForShop,
  addTemporaryChatMessage,
  formatChatTime,
  type TemporaryChat,
} from '@/lib/supabase-temporary-chats';
import { getUserProfile } from '@/lib/supabase-user-profiles';
import { sendTemporaryChatNotification } from '@/lib/chat-notification-system';
import toast from 'react-hot-toast';

interface TemporaryChatSectionProps {
  shopId: string;
  onLoginRequired?: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Is there formal suit available?',
  'Is corn starch available at your shop?',
  'Is facial hair removal offered at your shop?',
];

export const TemporaryChatSection = ({
  shopId,
  onLoginRequired,
}: TemporaryChatSectionProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [chats, setChats] = useState<TemporaryChat[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chats on mount and setup polling
  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, [shopId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats]);

  const loadChats = async () => {
    const fetchedChats = await getChatsForShop(shopId);
    setChats(fetchedChats);
    setLoading(false);
  };

  const handleSuggestedQuestion = (question: string) => {
    setMessage(question);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !profile) {
      onLoginRequired?.();
      return;
    }

    if (!message.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const newChat = await addTemporaryChatMessage(
        shopId,
        profile.name,
        message,
        user.email || undefined
      );

      if (newChat) {
        setChats([newChat, ...chats]);
        setMessage('');

        console.log('📤 Sending notification to shop owner...');
        const notificationResult = await sendTemporaryChatNotification({
          shopId,
          senderName: profile.name,
          message: message.trim(),
          senderEmail: user.email || undefined,
        });

        if (notificationResult.success) {
          toast.success('✅ Shop owner notified!', {
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

  return (
    <Card className="border-0 overflow-hidden shadow-lg bg-white dark:bg-slate-950">
      <CardHeader className="relative bg-gradient-to-r from-red-600 to-red-500 border-0 shadow-lg">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <MessageCircle className="h-6 w-6 text-white drop-shadow-lg" />
          </motion.div>
          <CardTitle className="text-xl text-white drop-shadow-lg font-bold">
            Quick Chat
          </CardTitle>
          <Sparkles className="h-5 w-5 text-red-200 drop-shadow-lg ml-auto animate-pulse" />
        </motion.div>
        <p className="text-xs text-red-100 dark:text-red-200 mt-2">
          💬 Chat with shop owner • Messages refresh every 5 seconds
        </p>
      </CardHeader>

      <CardContent className="relative space-y-4 pt-6">
        {/* Messages Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <div
            ref={scrollRef}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 h-64 overflow-y-auto space-y-3 border border-red-100 dark:border-red-900/20 shadow-inner"
          >
            {loading ? (
              <motion.div
                className="flex items-center justify-center h-full"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-8 w-8 rounded-full border-2 border-red-200 border-t-red-600 mx-auto mb-2"
                  />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Loading messages...
                  </p>
                </div>
              </motion.div>
            ) : chats.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center h-full"
              >
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-red-200 dark:text-red-900 mx-auto mb-2 opacity-50" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No messages yet. Be the first to chat!
                  </p>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence>
                {chats.map((chat, idx) => (
                   <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, x: -20, y: 20 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-red-50 dark:border-red-900/20 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with 3D effect */}
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="flex-shrink-0"
                      >
                        {chat.user_email ? (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              backgroundColor: `hsl(${
                                chat.user_email.charCodeAt(0) * 10
                              }, 70%, 50%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            {chat.user_name[0]?.toUpperCase() || '?'}
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 shadow-md" />
                        )}
                      </motion.div>

                      {/* Message Content */}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {chat.user_name}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 text-sm break-words mt-1">
                          {chat.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatChatTime(chat.created_at)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {!userIsLoggedIn ? (
            <motion.div
              className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-center shadow-md"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-3">
                ✨ Login to start chatting
              </p>
              <Button
                onClick={onLoginRequired}
                className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-shadow"
              >
                <LogIn className="h-4 w-4" />
                Login to Chat
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* User Info */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20"
              >
                {profile?.imageUrl ? (
                  <motion.img
                    src={profile.imageUrl}
                    alt={profile.name}
                    className="h-9 w-9 rounded-lg object-cover shadow-md"
                    whileHover={{ scale: 1.1 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: `hsl(${
                        profile?.name?.charCodeAt(0) || 0 * 10
                      }, 70%, 50%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {profile?.name[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {profile?.name || 'User'}
                </span>
              </motion.div>

              {/* Textarea with floating suggestions */}
              {/* Quick Suggestions - Now above the input */}
              <AnimatePresence>
                {message.trim() === '' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="space-y-2 mb-2"
                  >
                    <div className="flex items-center gap-2 px-1">
                      <Sparkles className="h-3 w-3 text-red-500" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">
                        Quick Questions
                      </p>
                    </div>
                    <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x">
                      {SUGGESTED_QUESTIONS.map((q, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => handleSuggestedQuestion(q)}
                          className="flex-shrink-0 px-3 py-1.5 text-[11px] bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-100 shadow-sm transition-all snap-start font-medium"
                        >
                          {q}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea Area */}
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  disabled={submitting}
                  className="min-h-24 text-sm resize-none rounded-xl border-2 border-red-100 dark:border-red-900/30 focus:border-red-500 dark:focus:border-red-400 bg-white dark:bg-slate-800 shadow-md focus:shadow-lg transition-all"
                  maxLength={500}
                />
              </div>

              {/* Character count */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {message.length}/500 characters
                </p>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </motion.div>
              </div>
            </form>
          )}
        </motion.div>

        {/* Info Banner with 3D effect */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-3 text-xs shadow-sm"
        >
          <p className="text-red-900 dark:text-red-200">
            <strong>✨ Note:</strong> Messages disappear at 1 AM daily. Quick
            conversations only.
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
};
