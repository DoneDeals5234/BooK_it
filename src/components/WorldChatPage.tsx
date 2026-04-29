import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, LogIn, X, ChevronLeft, Image as ImageIcon, Loader, Reply, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/lib/supabase';
import {
  getWorldChatMessages,
  addWorldChatMessage,
  editWorldChatMessage,
  deleteWorldChatMessage,
  formatWorldChatTime,
  uploadWorldChatImage,
  type WorldChatMessage,
} from '@/lib/supabase-world-chat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sendWorldChatNotification } from '@/lib/chat-notification-system';
import toast from 'react-hot-toast';

interface WorldChatPageProps {
  onClose: () => void;
  onShowLogin?: () => void;
}

export default function WorldChatPage({ onClose, onShowLogin }: WorldChatPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<WorldChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeMessage, setActiveMessage] = useState<WorldChatMessage | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessageText, setEditMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Load messages on mount and setup realtime subscription
  useEffect(() => {
    loadMessages();

    // Real-time subscription
    const subscription = supabase
      .channel('world-chat-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'world_chat_messages',
        },
        async (payload) => {
          // Fetch the fully populated message (with reply_to_message)
          const { data } = await supabase
            .from('world_chat_messages')
            .select('*, profiles(image_url), reply_to_message:world_chat_messages!reply_to(user_name, message)')
            .eq('id', payload.new.id)
            .single();
            
          if (data) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === data.id)) return prev;
              
              // Handle local join for real-time insert if reply_to is present but reply_to_message is null (foreign key missing)
              let newMessage = { ...data };
              if (newMessage.reply_to && !newMessage.reply_to_message) {
                const repliedMsg = prev.find(m => m.id === newMessage.reply_to);
                if (repliedMsg) {
                  newMessage.reply_to_message = {
                    user_name: repliedMsg.user_name,
                    message: repliedMsg.message
                  };
                }
              }

              return [newMessage as WorldChatMessage, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'world_chat_messages' },
        (payload) => {
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'world_chat_messages' },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive (using reverse flex direction so top is bottom)
  useEffect(() => {
    // Actually we're doing flex-col-reverse so we don't need manual scroll down,
    // but if we do standard scrolling we handle it here.
    // The messages are reversed, so scroll top should be 0 or bottom depending on structure
  }, [messages]);

  const loadMessages = async () => {
    const fetchedMessages = await getWorldChatMessages();
    setMessages(fetchedMessages);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
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

  const handlePressStart = (msg: WorldChatMessage) => {
    if (msg.user_id !== user?.uid) return;
    longPressTimer.current = setTimeout(() => {
      setActiveMessage(msg);
      setShowOptionsModal(true);
    }, 500); // 500ms long press
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDeleteMessage = async () => {
    if (!activeMessage) return;
    const success = await deleteWorldChatMessage(activeMessage.id);
    if (success) {
      setMessages(messages.filter(m => m.id !== activeMessage.id));
      toast.success('Message deleted');
    } else {
      toast.error('Failed to delete message');
    }
    setShowOptionsModal(false);
  };

  const handleSaveEdit = async () => {
    if (!activeMessage || !editMessageText.trim()) return;
    const success = await editWorldChatMessage(activeMessage.id, editMessageText);
    if (success) {
      setMessages(messages.map(m => m.id === activeMessage.id ? { ...m, message: editMessageText } : m));
      toast.success('Message updated');
      setIsEditing(false);
      setShowOptionsModal(false);
    } else {
      toast.error('Failed to update message');
    }
  };

  const openEditMode = () => {
    if (activeMessage) {
      setEditMessageText(activeMessage.message);
      setIsEditing(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !profile) {
      onShowLogin?.();
      return;
    }

    if (!message.trim() && !selectedImage) {
      toast.error('Please enter a message or select an image');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | undefined = undefined;

      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = (await uploadWorldChatImage(selectedImage, user.uid)) || undefined;
        setUploadingImage(false);

        if (selectedImage && !imageUrl) {
          toast.error('Failed to upload image. Message will be sent without image.');
        }
      }

      const newMessage = await addWorldChatMessage(
        profile.name,
        message.trim(),
        user.email || undefined,
        user.uid,
        imageUrl,
        replyTo?.id
      );

      if (newMessage) {
        setMessage('');
        removeImage();
        setReplyTo(null);

        // Notify in background
        sendWorldChatNotification({
          senderName: profile.name,
          message: message.trim(),
          senderEmail: user.email || undefined,
        }).catch(err => console.error("Notification failed", err));
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

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 flex flex-col font-sans h-full w-full">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full">
                <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight text-slate-900 dark:text-white">World Chat</h1>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Global Room
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 text-center text-xs text-purple-800 dark:text-purple-300 shadow-sm z-10 border-b border-purple-100 dark:border-purple-800/30">
        Messages are visible to everyone globally and disappear daily at 1 AM.
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col-reverse p-4 gap-4" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-2 m-auto">
            <Loader className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm font-medium">Connecting to World Chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 m-auto opacity-70">
            <MessageCircle className="h-16 w-16 text-slate-300 dark:text-slate-700" />
            <p className="text-sm">No messages yet. Be the first to chat!</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full flex flex-col-reverse gap-4">
            {messages.map((msg) => {
              const isMe = msg.user_id === user?.uid;
              const avatarUrl = msg.profiles?.image_url;
              
              return (
                <div key={msg.id} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 mb-2`}>
                  {/* Sender Avatar */}
                  <div 
                    className="flex-shrink-0 cursor-pointer transition-transform active:scale-90"
                    onClick={() => msg.user_id && navigate(`/profile/${msg.user_id}`)}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={msg.user_name}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                      />
                    ) : (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: `hsl(${msg.user_name.charCodeAt(0) * 15}, 70%, 50%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                        className="sm:w-10 sm:h-10 sm:text-sm shadow-sm"
                      >
                        {msg.user_name[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender Name */}
                    <span 
                      className={`text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 px-1 cursor-pointer hover:text-purple-600 transition-colors`}
                      onClick={() => msg.user_id && navigate(`/profile/${msg.user_id}`)}
                    >
                      {msg.user_name}
                    </span>

                    <div 
                      className={`relative rounded-2xl px-4 py-2.5 shadow-sm group cursor-pointer select-none ${
                        isMe 
                          ? 'bg-purple-600 text-white rounded-tr-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                      }`}
                      onTouchStart={() => handlePressStart(msg)}
                      onTouchEnd={handlePressEnd}
                      onTouchMove={handlePressEnd}
                      onMouseDown={() => handlePressStart(msg)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                    >
                      {/* Replied Message Reference */}
                      {msg.reply_to_message && (
                        <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${
                          isMe 
                            ? 'bg-purple-700/50 border-purple-400 text-purple-100' 
                            : 'bg-slate-100 dark:bg-slate-700 border-purple-500 text-slate-600 dark:text-slate-300'
                        }`}>
                          <p className="font-bold mb-0.5">{msg.reply_to_message.user_name}</p>
                          <p className="line-clamp-2 opacity-90">{msg.reply_to_message.message}</p>
                        </div>
                      )}

                      {/* Image Attachment */}
                      {msg.image_url && (
                        <div className="mb-2">
                          <img
                            src={msg.image_url}
                            alt="Attachment"
                            className="rounded-lg max-h-60 object-cover w-full cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.image_url, '_blank')}
                          />
                        </div>
                      )}

                      {/* Message Text */}
                      <p className="text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>

                      {/* Time & Reply Action */}
                      <div className={`flex items-center gap-3 mt-1.5 ${isMe ? 'justify-end text-purple-200' : 'justify-start text-slate-400'}`}>
                        <span className="text-[9px] sm:text-[10px] uppercase font-medium tracking-wider">
                          {formatWorldChatTime(msg.created_at)}
                        </span>
                        {!isMe && (
                          <button 
                            onClick={() => setReplyTo(msg)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-purple-500"
                          >
                            <Reply className="h-3 w-3" />
                            <span className="text-[10px] font-bold">Reply</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-20">
        <div className="max-w-4xl mx-auto w-full">
          {!userIsLoggedIn ? (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-bold text-purple-900 dark:text-purple-100">Join the Conversation</h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">Login to chat and interact with users globally</p>
              </div>
              <Button onClick={onShowLogin} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 rounded-xl">
                <LogIn className="h-4 w-4 mr-2" />
                Login to Chat
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Reply Preview */}
              {replyTo && (
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border-l-4 border-purple-500">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400">Replying to {replyTo.user_name}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{replyTo.message}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative inline-block w-max">
                  <img src={imagePreview} alt="Upload preview" className="h-20 rounded-lg object-cover border-2 border-purple-500" />
                  <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center border border-transparent focus-within:border-purple-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 transition-colors pl-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={submitting || uploadingImage}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting || uploadingImage}
                    className="p-3 text-slate-400 hover:text-purple-600 transition-colors shrink-0 rounded-xl"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  
                  <textarea
                    placeholder="Message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    disabled={submitting || uploadingImage}
                    className="flex-1 max-h-32 min-h-[44px] py-3 px-2 bg-transparent text-sm resize-none focus:outline-none"
                    rows={Math.min(4, Math.max(1, message.split('\n').length))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim() || selectedImage) handleSubmit(e);
                      }
                    }}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || uploadingImage || (!message.trim() && !selectedImage)}
                  size="icon"
                  className={`h-11 w-11 rounded-2xl shrink-0 transition-all ${
                    message.trim() || selectedImage 
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {submitting || uploadingImage ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5 ml-1" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Options Modal */}
      <Dialog open={showOptionsModal} onOpenChange={(open) => {
        if (!open) {
          setShowOptionsModal(false);
          setIsEditing(false);
        }
      }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Message' : 'Message Options'}</DialogTitle>
          </DialogHeader>
          
          {isEditing ? (
            <div className="space-y-4 pt-4">
              <Textarea 
                value={editMessageText}
                onChange={(e) => setEditMessageText(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSaveEdit} className="bg-purple-600 hover:bg-purple-700">Save Changes</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-4">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12"
                onClick={openEditMode}
              >
                <Pencil className="h-4 w-4" />
                Edit Message
              </Button>
              <Button 
                variant="destructive" 
                className="w-full justify-start gap-2 h-12"
                onClick={handleDeleteMessage}
              >
                <Trash2 className="h-4 w-4" />
                Delete Message
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
