import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageSquare, Send, Reply, Mail, Phone, User, Calendar, Loader2, CheckCircle } from 'lucide-react';
import { getAllMessages, replyToMessage, markMessageAsRead, type UserMessage } from '@/lib/supabase-user-messages';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export const StaffInbox = () => {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'thought' | 'feedback' | 'support'>('all');
  const { user } = useAuth();

  useEffect(() => {
    loadMessages();
    // Reload messages every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const allMessages = await getAllMessages();
      setMessages(allMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = async (message: UserMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      try {
        await markMessageAsRead(message.id);
        setMessages(messages.map(m => m.id === message.id ? { ...m, isRead: true } : m));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim() || !user?.email) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsReplying(true);
    try {
      await replyToMessage(
        selectedMessage.id,
        replyText.trim(),
        user.email
      );

      toast.success('Reply sent successfully!');
      setReplyText('');
      setSelectedMessage(null);
      await loadMessages();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setIsReplying(false);
    }
  };

  const getFilteredMessages = () => {
    let filtered = messages;

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.senderName.toLowerCase().includes(searchLower) ||
        msg.senderEmail.toLowerCase().includes(searchLower) ||
        msg.message.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      if (filterType === 'unread') {
        filtered = filtered.filter(msg => !msg.isRead);
      } else {
        filtered = filtered.filter(msg => msg.messageType === filterType);
      }
    }

    return filtered;
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'thought':
        return '💡';
      case 'feedback':
        return '⭐';
      case 'support':
        return '🆘';
      default:
        return '📝';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'thought':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'feedback':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'support':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const filteredMessages = getFilteredMessages();
  const unreadCount = messages.filter(m => !m.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📬 Support Inbox
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage user messages and feedback
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{messages.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Messages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{unreadCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Unread Messages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {messages.filter(m => m.adminReply).length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Replied</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Input
            placeholder="Search by name, email, or message content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />

          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all' as const, label: 'All Messages' },
              { value: 'unread' as const, label: 'Unread' },
              { value: 'thought' as const, label: '💡 Thoughts' },
              { value: 'feedback' as const, label: '⭐ Feedback' },
              { value: 'support' as const, label: '🆘 Support' },
            ].map(filter => (
              <Button
                key={filter.value}
                variant={filterType === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No messages found</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map(message => (
            <Card
              key={message.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                !message.isRead ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50' : ''
              } ${selectedMessage?.id === message.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleSelectMessage(message)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {message.senderName[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {message.senderName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {message.senderEmail}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getMessageTypeColor(message.messageType)}`}>
                        {getMessageTypeIcon(message.messageType)} {message.messageType.charAt(0).toUpperCase() + message.messageType.slice(1)}
                      </span>
                    </div>

                    {/* Message Content */}
                    <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2 mb-3">
                      {message.message}
                    </p>

                    {/* Reply Status */}
                    {message.adminReply && (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-green-800 dark:text-green-400 mb-1">
                          ✅ Replied by {message.adminReplyBy}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400">
                          {message.adminReply}
                        </p>
                        {message.replyDate && (
                          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                            {new Date(message.replyDate).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Action Indicator */}
                  {!message.isRead && (
                    <div className="h-3 w-3 rounded-full bg-primary flex-shrink-0 mt-1" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reply Dialog */}
      {selectedMessage && (
        <Dialog open={!!selectedMessage} onOpenChange={(open) => {
          if (!open) {
            setSelectedMessage(null);
            setReplyText('');
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Reply className="h-5 w-5" />
                Reply to Message
              </DialogTitle>
              <DialogDescription>
                Send a reply to {selectedMessage.senderName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Original Message */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      {selectedMessage.senderName}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedMessage.senderEmail}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getMessageTypeColor(selectedMessage.messageType)}`}>
                    {getMessageTypeIcon(selectedMessage.messageType)} {selectedMessage.messageType}
                  </span>
                </div>
                <p className="text-sm text-foreground">{selectedMessage.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Reply Text Area */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Your Reply *</label>
                <Textarea
                  placeholder="Type your reply message here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isReplying}
                  className="min-h-24 resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {replyText.length}/1000 characters
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedMessage(null);
                    setReplyText('');
                  }}
                  disabled={isReplying}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReply}
                  disabled={isReplying || !replyText.trim()}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                >
                  {isReplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
