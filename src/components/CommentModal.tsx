import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { addComment, getCommentsByVideoId, type Comment } from '@/lib/supabase-comments';
import { supabase } from '@/lib/supabase';

interface CommentModalProps {
  videoId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export const CommentModal = ({ videoId, onClose, onCommentAdded }: CommentModalProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const COMMENTS_PER_PAGE = 10;

  // Load comments
  useEffect(() => {
    loadComments();

    // Subscribe to comment changes
    const subscription = supabase
      .channel(`comments-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `video_id=eq.${videoId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [videoId]);

  const loadComments = async (newOffset: number = 0) => {
    try {
      setLoading(true);
      const result = await getCommentsByVideoId(videoId, COMMENTS_PER_PAGE, newOffset);
      if (result) {
        if (newOffset === 0) {
          setComments(result.comments);
        } else {
          setComments((prev) => [...prev, ...result.comments]);
        }
        setTotal(result.total);
        setOffset(newOffset + COMMENTS_PER_PAGE);
        setHasMore(newOffset + COMMENTS_PER_PAGE < result.total);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !user?.uid) return;

    setPosting(true);
    try {
      const result = await addComment(
        videoId,
        user.uid,
        user.email || 'Anonymous',
        profile?.imageUrl || null,
        commentText.trim()
      );

      if (result) {
        setCommentText('');
        
        // Optimistic update: Add the comment to local state immediately
        setComments((prev) => {
          if (prev.some(c => c.id === result.id)) return prev;
          return [result, ...prev];
        });

        if (onCommentAdded) onCommentAdded();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setPosting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Drawer - 50% height */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-xl max-h-[50vh] flex flex-col animate-in slide-in-from-bottom-5">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white dark:bg-slate-900 rounded-t-xl">
          <h2 className="text-lg font-semibold">Comments</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto">
          {loading && comments.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    {comment.uploaderImageUrl ? (
                      <img
                        src={comment.uploaderImageUrl}
                        alt={comment.uploaderName}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gray-500 flex-shrink-0">
                        {comment.uploaderName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{comment.uploaderName}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground break-words">{comment.commentText}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={() => loadComments(offset)}
                  className="w-full py-2 text-sm text-primary hover:text-primary/90 font-medium transition-colors"
                >
                  Load more comments
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comment Input */}
        {user && (
          <div className="border-t border-border p-4 bg-white dark:bg-slate-900 sticky bottom-0">
            <div className="flex items-end gap-2">
              {/* User Avatar */}
              {profile?.imageUrl ? (
                <img
                  src={profile.imageUrl}
                  alt={user.email || 'User'}
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gray-500 flex-shrink-0">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
              )}

              {/* Input and Send Button */}
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  placeholder="Add a comment..."
                  disabled={posting}
                  className="flex-1 px-3 py-2 border border-input rounded-full bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
                />
                <button
                  onClick={handlePostComment}
                  disabled={posting || !commentText.trim()}
                  className="bg-primary text-white hover:bg-primary/90 disabled:opacity-50 rounded-full p-2 transition-colors flex-shrink-0"
                  title="Post comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!user && (
          <div className="border-t border-border p-4 text-center text-sm text-muted-foreground bg-white dark:bg-slate-900">
            Please sign in to comment
          </div>
        )}
      </div>
    </div>
  );
};
