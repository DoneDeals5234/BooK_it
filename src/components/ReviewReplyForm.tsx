import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Loader2, MessageSquare } from 'lucide-react';
import { addReplyToReview } from '@/lib/supabase-reviews';
import type { Review, ReviewReply } from '@/lib/supabase-reviews';

interface ReviewReplyFormProps {
  review: Review;
  shopId: string;
  ownerId: string;
  onReplySubmitted?: (reply: ReviewReply) => void;
  onCancel?: () => void;
}

export const ReviewReplyForm = ({
  review,
  shopId,
  ownerId,
  onReplySubmitted,
  onCancel,
}: ReviewReplyFormProps) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!replyText.trim()) {
      setError('Please enter your reply');
      return;
    }

    setIsSubmitting(true);

    try {
      const reply = await addReplyToReview(review.id, shopId, ownerId, replyText);

      if (reply) {
        setReplyText('');
        onReplySubmitted?.(reply);
      } else {
        setError('Failed to submit reply. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting reply:', err);
      setError('An error occurred while submitting your reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Reply to Review</CardTitle>
            <CardDescription className="mt-1">
              Responding to a review from {review.userName}
            </CardDescription>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Review Context */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Original Review:
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{review.reviewText}</p>
          </div>

          {/* Reply Text Area */}
          <div>
            <label className="block text-sm font-medium mb-2">Your Reply</label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Thank you for your feedback. We appreciate your review..."
              maxLength={500}
              rows={4}
              className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{replyText.length}/500</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Submit Reply
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
