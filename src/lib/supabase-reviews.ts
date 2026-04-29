import { supabase } from '@/lib/supabase';
import { retryWithBackoff } from '@/lib/retry-utils';

export interface Review {
  id: string;
  shopId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  title: string;
  reviewText: string;
  imageUrl?: string;
  isVerifiedCustomer: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
  replies?: ReviewReply[];
}

export interface ReviewReply {
  id: string;
  reviewId: string;
  shopId: string;
  ownerId: string;
  replyText: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  shopId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  title: string;
  reviewText: string;
  imageUrl?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  reviewText?: string;
  imageUrl?: string;
}

// Fetch all reviews for a shop
export const getReviewsForShop = async (shopId: string): Promise<Review[]> => {
  try {
    const { data: reviewsData, error } = await retryWithBackoff(() =>
      supabase
        .from('reviews')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    if (!reviewsData) return [];

    // Fetch replies for each review
    const reviews = await Promise.all(
      reviewsData.map(async (review) => {
        const { data: repliesData } = await supabase
          .from('review_replies')
          .select('*')
          .eq('review_id', review.id)
          .order('created_at', { ascending: true });

        return {
          id: review.id,
          shopId: review.shop_id,
          userId: review.user_id,
          userEmail: review.user_email,
          userName: review.user_name,
          rating: review.rating,
          title: review.title,
          reviewText: review.review_text,
          imageUrl: review.image_url,
          isVerifiedCustomer: review.is_verified_customer,
          helpfulCount: review.helpful_count,
          createdAt: new Date(review.created_at),
          updatedAt: new Date(review.updated_at),
          replies: (repliesData || []).map((reply) => ({
            id: reply.id,
            reviewId: reply.review_id,
            shopId: reply.shop_id,
            ownerId: reply.owner_id,
            replyText: reply.reply_text,
            createdAt: new Date(reply.created_at),
            updatedAt: new Date(reply.updated_at),
          })),
        };
      })
    );

    return reviews;
  } catch (error) {
    console.error('Error in getReviewsForShop:', error);
    return [];
  }
};

// Fetch a single review with its replies
export const getReviewById = async (reviewId: string): Promise<Review | null> => {
  try {
    const { data: reviewData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (error || !reviewData) {
      console.error('Error fetching review:', error);
      return null;
    }

    const { data: repliesData } = await supabase
      .from('review_replies')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });

    return {
      id: reviewData.id,
      shopId: reviewData.shop_id,
      userId: reviewData.user_id,
      userEmail: reviewData.user_email,
      userName: reviewData.user_name,
      rating: reviewData.rating,
      title: reviewData.title,
      reviewText: reviewData.review_text,
      imageUrl: reviewData.image_url,
      isVerifiedCustomer: reviewData.is_verified_customer,
      helpfulCount: reviewData.helpful_count,
      createdAt: new Date(reviewData.created_at),
      updatedAt: new Date(reviewData.updated_at),
      replies: (repliesData || []).map((reply) => ({
        id: reply.id,
        reviewId: reply.review_id,
        shopId: reply.shop_id,
        ownerId: reply.owner_id,
        replyText: reply.reply_text,
        createdAt: new Date(reply.created_at),
        updatedAt: new Date(reply.updated_at),
      })),
    };
  } catch (error) {
    console.error('Error in getReviewById:', error);
    return null;
  }
};

// Create a new review
export const createReview = async (input: CreateReviewInput): Promise<Review | null> => {
  try {
    console.log('📝 Creating review with data:', {
      shop_id: input.shopId,
      user_id: input.userId,
      rating: input.rating,
    });

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        shop_id: input.shopId,
        user_id: input.userId,
        user_email: input.userEmail,
        user_name: input.userName,
        rating: input.rating,
        title: input.title,
        review_text: input.reviewText,
        image_url: input.imageUrl || null,
        is_verified_customer: false,
        helpful_count: 0,
      })
      .select()
      .single();

    if (error) {
      const errorMsg = error.message || 'Unknown error';
      console.error('❌ Error creating review:', errorMsg);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      if (error.code) console.error('Error code:', error.code);
      if (error.details) console.error('Error details:', error.details);
      if (error.hint) console.error('Error hint:', error.hint);
      return null;
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      userId: data.user_id,
      userEmail: data.user_email,
      userName: data.user_name,
      rating: data.rating,
      title: data.title,
      reviewText: data.review_text,
      imageUrl: data.image_url,
      isVerifiedCustomer: data.is_verified_customer,
      helpfulCount: data.helpful_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      replies: [],
    };
  } catch (error) {
    console.error('Error in createReview:', error);
    return null;
  }
};

// Update a review
export const updateReview = async (
  reviewId: string,
  input: UpdateReviewInput
): Promise<Review | null> => {
  try {
    const updateData: any = {};
    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.reviewText !== undefined) updateData.review_text = input.reviewText;
    if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;

    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating review:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
      });
      return null;
    }

    const review = await getReviewById(reviewId);
    return review;
  } catch (error) {
    console.error('Error in updateReview:', error);
    return null;
  }
};

// Delete a review
export const deleteReview = async (reviewId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return false;
  }
};

// Check if user already reviewed the shop
export const hasUserReviewedShop = async (
  shopId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking review:', error);
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasUserReviewedShop:', error);
    return false;
  }
};

// Add a reply to a review (shop owner)
export const addReplyToReview = async (
  reviewId: string,
  shopId: string,
  ownerId: string,
  replyText: string
): Promise<ReviewReply | null> => {
  try {
    const { data, error } = await supabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        shop_id: shopId,
        owner_id: ownerId,
        reply_text: replyText,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding reply:', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return null;
    }

    return {
      id: data.id,
      reviewId: data.review_id,
      shopId: data.shop_id,
      ownerId: data.owner_id,
      replyText: data.reply_text,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in addReplyToReview:', error);
    return null;
  }
};

// Update a reply
export const updateReply = async (
  replyId: string,
  replyText: string
): Promise<ReviewReply | null> => {
  try {
    const { data, error } = await supabase
      .from('review_replies')
      .update({ reply_text: replyText })
      .eq('id', replyId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating reply:', error);
      return null;
    }

    return {
      id: data.id,
      reviewId: data.review_id,
      shopId: data.shop_id,
      ownerId: data.owner_id,
      replyText: data.reply_text,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in updateReply:', error);
    return null;
  }
};

// Delete a reply
export const deleteReply = async (replyId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('review_replies').delete().eq('id', replyId);

    if (error) {
      console.error('Error deleting reply:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteReply:', error);
    return false;
  }
};

// Upload review image to storage
export const uploadReviewImage = async (
  file: File,
  shopId: string,
  userId: string
): Promise<string | null> => {
  try {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}/${userId}/${timestamp}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('review-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', {
        message: error.message || 'Unknown error',
        statusCode: error.statusCode,
      });

      // Provide helpful error message for bucket not found
      if (error.message?.includes('Bucket not found')) {
        console.warn('⚠️ Storage bucket "review-images" not found. Please create it in Supabase dashboard:');
        console.warn('1. Go to Supabase Dashboard -> Storage');
        console.warn('2. Click "New Bucket"');
        console.warn('3. Name it "review-images" and make it public');
      }
      return null;
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('review-images')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in uploadReviewImage:', errorMsg);
    return null;
  }
};

// Delete review image from storage
export const deleteReviewImage = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = imageUrl.substring(imageUrl.indexOf('review-images/') + 14);

    const { error } = await supabase.storage.from('review-images').remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteReviewImage:', error);
    return false;
  }
};
