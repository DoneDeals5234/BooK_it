import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Clock, CheckCircle2, X, Send, Loader2 } from 'lucide-react';
import { getUserMessages, type UserMessage } from '@/lib/supabase-user-messages';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface ThoughtInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThoughtInboxModal = ({ isOpen, onClose }: ThoughtInboxModalProps) => {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user?.uid) {
      loadMessages();
    }
  }, [isOpen, user?.uid]);

  const loadMessages = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getUserMessages(user.uid);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">My Thoughts & Support</DialogTitle>
                <DialogDescription className="text-blue-100">
                  Track your feedback and support requests
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50 dark:bg-slate-950" ref={scrollRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-muted-foreground animate-pulse">Loading your inbox...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Send className="h-10 w-10 text-blue-500" />
              </div>
              <div className="max-w-xs">
                <h3 className="text-lg font-semibold mb-1">No messages yet</h3>
                <p className="text-sm text-muted-foreground">
                  Send your first thought or feedback using the "Send Thought" button in the menu!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-3">
                  {/* User Message (Right Aligned) */}
                  <div className="flex flex-col items-end">
                    <div className="max-w-[85%] bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none shadow-md">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
                          {msg.messageType}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 mr-2">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Admin Reply (Left Aligned) */}
                  {msg.adminReply ? (
                    <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-4 duration-500">
                      <div className="max-w-[85%] bg-white dark:bg-slate-800 border border-border p-4 rounded-2xl rounded-tl-none shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                        <div className="flex items-center gap-2 mb-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Staff Response</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground italic">"{msg.adminReply}"</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 ml-2">
                        {msg.replyDate ? new Date(msg.replyDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-2 text-[10px] text-amber-600 font-medium animate-pulse">
                      <Clock className="h-3 w-3" />
                      Waiting for staff response...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white dark:bg-slate-900 flex justify-center">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto px-8">
            Close Inbox
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
