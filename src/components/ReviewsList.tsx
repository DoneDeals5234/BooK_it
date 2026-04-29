import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Trash2, Edit2, MessageSquare } from 'lucide-react';
import { deleteReview } from '@/lib/supabase-reviews';
import type { Review } from '@/lib/supabase-reviews';

interface ReviewsListProps {
  reviews: Review[];
  currentUserId?: string;
  shopOwnerId?: string;
  onDeleteReview?: (reviewId: string) => void;
  onEditReview?: (review: Review) => void;
  onReplyClick?: (review: Review) => void;
  averageRating?: number;
  totalReviews?: number;
}

export const ReviewsList = ({
  reviews,
  currentUserId,
  shopOwnerId,
  onDeleteReview,
  onEditReview,
  onReplyClick,
  averageRating,
  totalReviews,
}: ReviewsListProps) => {
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const toggleReplies = (reviewId: string) => {
    const newSet = new Set(expandedReplies);
    if (newSet.has(reviewId)) {
      newSet.delete(reviewId);
    } else {
      newSet.add(reviewId);
    }
    setExpandedReplies(newSet);
  };

  const handleDelete = async (reviewId: string) => {
    if (confirm('Are you sure you want to delete this review?')) {
      const success = await deleteReview(reviewId);
      if (success) {
        onDeleteReview?.(reviewId);
      }
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className="h-4 w-4"
            fill={star <= rating ? '#FFA500' : 'none'}
            color={star <= rating ? '#FFA500' : '#D1D5DB'}
          />
        ))}
      </div>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Reviews</CardTitle>
          <CardDescription>No reviews yet. Be the first to review this shop!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Customer Reviews</CardTitle>
            {averageRating !== undefined && (
              <div className="flex items-center gap-2 mt-2">
                {renderStars(Math.round(averageRating))}
                <span className="text-lg font-semibold">{averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({totalReviews || reviews.length} {totalReviews === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b last:border-b-0 pb-6 last:pb-0">
              {/* Review Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {review.userName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{review.userName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mb-2">{renderStars(review.rating)}</div>
                  <h4 className="font-semibold mb-1">{review.title}</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                    {review.reviewText}
                  </p>

                  {/* Review Image */}
                  {review.imageUrl && (
                    <div className="mb-3">
                      <img
                        src={review.imageUrl}
                        alt="Review"
                        className="max-w-xs h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {currentUserId === review.userId && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => onEditReview?.(review)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                      title="Edit review"
                    >
                      <Edit2 className="h-4 w-4 text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                      title="Delete review"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Replies Section */}
              {review.replies && review.replies.length > 0 && (
                <div className="mt-4 ml-13">
                  <button
                    onClick={() => toggleReplies(review.id)}
                    className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium mb-3"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {review.replies.length} {review.replies.length === 1 ? 'Reply' : 'Replies'}
                  </button>

                  {expandedReplies.has(review.id) && (
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      {review.replies.map((reply) => (
                        <div key={reply.id} className="border-l-4 border-orange-500 pl-4">
                          <p className="text-xs font-semibold text-orange-600 mb-1">Shop Owner Response</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{reply.replyText}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatDate(reply.createdAt)}</p>
                          {shopOwnerId === reply.ownerId && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => {
                                  // Implement edit reply
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  // Implement delete reply
                                }}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply Button (for shop owner) */}
              {shopOwnerId && !review.replies?.some((r) => r.ownerId === shopOwnerId) && (
                <button
                  onClick={() => onReplyClick?.(review)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 rounded-lg text-sm font-medium transition"
                >
                  <MessageSquare className="h-4 w-4" />
                  Reply to Review
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
