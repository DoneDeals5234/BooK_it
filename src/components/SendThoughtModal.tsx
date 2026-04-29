import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react';
import { sendUserMessage } from '@/lib/supabase-user-messages';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import toast from 'react-hot-toast';

interface SendThoughtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SendThoughtModal = ({ isOpen, onClose }: SendThoughtModalProps) => {
  const [messageType, setMessageType] = useState<'thought' | 'feedback' | 'support'>('thought');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const handleClose = () => {
    setMessage('');
    setMessageType('thought');
    setIsSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!user?.uid) {
      toast.error('Please sign in to send a message');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendUserMessage(
        user.uid,
        profile?.name || user.email || 'Anonymous',
        user.email || '',
        message.trim(),
        messageType,
        profile?.phone
      );

      setIsSuccess(true);
      toast.success('Message sent successfully!');

      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Send Your Thought
          </DialogTitle>
          <DialogDescription>
            Share your feedback, ideas, or support requests with us
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Thank you!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your message has been sent successfully. We'll get back to you soon.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Message Type Selection */}
              <div className="space-y-2">
                <Label>Message Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'thought' as const, label: 'Thought', emoji: '💡' },
                    { value: 'feedback' as const, label: 'Feedback', emoji: '⭐' },
                    { value: 'support' as const, label: 'Support', emoji: '🆘' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setMessageType(type.value)}
                      className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 border-2 flex flex-col items-center gap-1 ${
                        messageType === type.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background text-foreground border-border hover:border-blue-400'
                      }`}
                    >
                      <span className="text-lg">{type.emoji}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <Label htmlFor="message">Your Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Write your thoughts, feedback, or describe your issue..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-32 resize-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {message.length}/1000 characters
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
