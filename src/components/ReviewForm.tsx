import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Upload, X, Loader2 } from 'lucide-react';
import { createReview, uploadReviewImage, hasUserReviewedShop, updateReview } from '@/lib/supabase-reviews';
import type { Review } from '@/lib/supabase-reviews';

interface ReviewFormProps {
  shopId: string;
  userId: string;
  userEmail: string;
  userName: string;
  onReviewSubmitted?: (review: Review) => void;
  existingReview?: Review;
  onCancel?: () => void;
}

export const ReviewForm = ({
  shopId,
  userId,
  userEmail,
  userName,
  onReviewSubmitted,
  existingReview,
  onCancel,
}: ReviewFormProps) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [reviewText, setReviewText] = useState(existingReview?.reviewText || '');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(existingReview?.imageUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a review title');
      return;
    }

    if (!reviewText.trim()) {
      setError('Please enter your review');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = previewUrl && !selectedImage ? previewUrl : undefined;

      // Upload image if selected
      if (selectedImage) {
        const uploadedUrl = await uploadReviewImage(selectedImage, shopId, userId);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          setError(
            'Failed to upload image. Please ensure the storage bucket is set up correctly or try without an image.'
          );
          setIsSubmitting(false);
          return;
        }
      }

      let review: Review | null;

      if (existingReview) {
        // Update existing review
        review = await updateReview(existingReview.id, {
          rating,
          title,
          reviewText,
          imageUrl,
        });
      } else {
        // Create new review
        review = await createReview({
          shopId,
          userId,
          userEmail,
          userName,
          rating,
          title,
          reviewText,
          imageUrl,
        });
      }

      if (review) {
        setRating(0);
        setTitle('');
        setReviewText('');
        setSelectedImage(null);
        setPreviewUrl('');
        onReviewSubmitted?.(review);
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      console.error('❌ Error submitting review');
      console.error('Error message:', errorMessage);
      console.error('Error object:', err);

      // Show user-friendly error messages
      if (errorMessage?.toLowerCase().includes('unique') || errorMessage?.toLowerCase().includes('already')) {
        setError('You have already reviewed this shop. Edit your existing review instead.');
      } else if (errorMessage?.toLowerCase().includes('bucket')) {
        setError('Image storage is not configured. Please try without an image.');
      } else if (errorMessage?.toLowerCase().includes('permission') || errorMessage?.toLowerCase().includes('row level security')) {
        setError('Permission denied. Please ensure you are logged in and try again.');
      } else {
        setError(`Failed to submit review: ${errorMessage || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20 shadow-lg">
      <CardHeader>
        <CardTitle>{existingReview ? 'Edit Your Review' : 'Share Your Review'}</CardTitle>
        <CardDescription>Help others by sharing your experience at this shop</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className="h-8 w-8"
                    fill={star <= (hoveredRating || rating) ? '#FFA500' : 'none'}
                    color={star <= (hoveredRating || rating) ? '#FFA500' : '#D1D5DB'}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Review Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience in a few words"
              maxLength={100}
              className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-700"
            />
            <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium mb-2">Your Review</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your detailed experience, what you liked, what could be improved..."
              maxLength={1000}
              rows={5}
              className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:border-gray-700 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{reviewText.length}/1000</p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Add Photo (Optional)</label>
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-40 w-40 object-cover rounded-lg border-2 border-orange-300"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-gray-500">PNG, JPG up to 5MB</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                existingReview ? 'Update Review' : 'Submit Review'
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
