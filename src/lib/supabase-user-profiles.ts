import { supabase } from './supabase';
import { sanitizeSupabaseUrl } from './utils';

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone: string;
  imageUrl?: string;
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  google_map_link?: string;
  instagram_id?: string;
  facebook_id?: string;
  instagram_url?: string;
  facebook_url?: string;
  createdAt: string;
  updatedAt: string;
}

// Search user profiles by name, phone, email, or location fields
export const searchUserProfiles = async (query: string): Promise<UserProfile[]> => {
  if (!query.trim()) return [];

  try {
    const searchTerm = query.trim();

    // Use server-side filtering for better performance and to handle missing columns gracefully
    let queryBuilder = supabase
      .from('user_profiles')
      .select('*');
    
    // Search in name, email, and phone
    queryBuilder = queryBuilder.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error searching profiles:', error);
      return [];
    }

    if (!data) return [];

    return (data as any[]).map((profile) => ({
        id: profile.id,
        userId: profile.user_id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        imageUrl: sanitizeSupabaseUrl(profile.image_url),
        address: profile.address,
        village: profile.village,
        district: profile.district,
        state: profile.state,
        country: profile.country,
        latitude: profile.latitude,
        longitude: profile.longitude,
        google_map_link: profile.google_map_link,
        instagram_id: profile.instagram_id,
        facebook_id: profile.facebook_id,
        instagram_url: profile.instagram_url,
        facebook_url: profile.facebook_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      }));
  } catch (error) {
    console.error('Error in searchUserProfiles:', error);
    return [];
  }
};

export const getUserProfileByEmail = async (email: string): Promise<{ data: UserProfile | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    const profile: UserProfile = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      imageUrl: sanitizeSupabaseUrl(data.image_url),
      address: data.address,
      village: data.village,
      district: data.district,
      state: data.state,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      google_map_link: data.google_map_link,
      instagram_id: data.instagram_id,
      facebook_id: data.facebook_id,
      instagram_url: data.instagram_url,
      facebook_url: data.facebook_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { data: profile, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('Fetching profile for user:', userId);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('User profile fetch error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    if (!data) {
      console.log('No profile found for user:', userId);
      return null;
    }

    // Map database columns to interface
    const profile: UserProfile = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      imageUrl: sanitizeSupabaseUrl(data.image_url),
      address: data.address,
      village: data.village,
      district: data.district,
      state: data.state,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
      google_map_link: data.google_map_link,
      instagram_id: data.instagram_id,
      facebook_id: data.facebook_id,
      instagram_url: data.instagram_url,
      facebook_url: data.facebook_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    console.log('Profile fetched successfully:', profile);
    return profile;
  } catch (error: any) {
    console.error('Error fetching user profile:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
    });
    return null;
  }
};

export const saveUserProfile = async (
  userId: string,
  name: string,
  phone: string,
  imageUrl?: string,
  locationData?: {
    email?: string;
    address?: string;
    village?: string;
    district?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    google_map_link?: string;
    instagram_id?: string;
    facebook_id?: string;
    instagram_url?: string;
    facebook_url?: string;
  }
): Promise<UserProfile> => {
  try {
    const existingProfile = await getUserProfile(userId);
    const now = new Date().toISOString();

    if (existingProfile) {
      // Update existing profile
      const updateData: any = {
        name,
        phone,
        updated_at: now,
      };

      if (imageUrl) {
        updateData.image_url = imageUrl;
      } else if (existingProfile.imageUrl) {
        updateData.image_url = existingProfile.imageUrl;
      }

      // Add location data if provided
      if (locationData) {
        if (locationData.email !== undefined) updateData.email = locationData.email;
        if (locationData.address !== undefined) updateData.address = locationData.address;
        if (locationData.village !== undefined) updateData.village = locationData.village;
        if (locationData.district !== undefined) updateData.district = locationData.district;
        if (locationData.state !== undefined) updateData.state = locationData.state;
        if (locationData.country !== undefined) updateData.country = locationData.country;
        if (locationData.latitude !== undefined) updateData.latitude = locationData.latitude;
        if (locationData.longitude !== undefined) updateData.longitude = locationData.longitude;
        if (locationData.google_map_link !== undefined) updateData.google_map_link = locationData.google_map_link;
        if (locationData.instagram_id !== undefined) updateData.instagram_id = locationData.instagram_id;
        if (locationData.facebook_id !== undefined) updateData.facebook_id = locationData.facebook_id;
        if (locationData.instagram_url !== undefined) updateData.instagram_url = locationData.instagram_url;
        if (locationData.facebook_url !== undefined) updateData.facebook_url = locationData.facebook_url;
      }

      console.log('Updating profile:', { userId, updateData });

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        const errorDetails = {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status: (error as any).status,
        };
        console.error('Update error:', errorDetails);
        throw error;
      }
      console.log('Profile updated:', data);

      // Map response to UserProfile interface
      const profile: UserProfile = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        imageUrl: data.image_url,
        address: data.address,
        village: data.village,
        district: data.district,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        google_map_link: data.google_map_link,
        instagram_id: data.instagram_id,
        facebook_id: data.facebook_id,
        instagram_url: data.instagram_url,
        facebook_url: data.facebook_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return profile;
    } else {
      // Create new profile
      const insertData: any = {
        user_id: userId,
        name,
        phone,
        image_url: imageUrl || null,
      };

      // Add location data if provided
      if (locationData) {
        insertData.email = locationData.email || null;
        insertData.address = locationData.address || null;
        insertData.village = locationData.village || null;
        insertData.district = locationData.district || null;
        insertData.state = locationData.state || null;
        insertData.country = locationData.country || null;
        insertData.latitude = locationData.latitude || null;
        insertData.longitude = locationData.longitude || null;
        insertData.google_map_link = locationData.google_map_link || null;
        insertData.instagram_id = locationData.instagram_id || null;
        insertData.facebook_id = locationData.facebook_id || null;
        insertData.instagram_url = locationData.instagram_url || null;
        insertData.facebook_url = locationData.facebook_url || null;
      }

      console.log('Creating new profile:', insertData);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        const errorDetails = {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status: (error as any).status,
        };
        console.error('Insert error:', errorDetails);
        throw error;
      }
      console.log('Profile created:', data);

      // Map response to UserProfile interface
      const profile: UserProfile = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        imageUrl: data.image_url,
        address: data.address,
        village: data.village,
        district: data.district,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        google_map_link: data.google_map_link,
        instagram_id: data.instagram_id,
        facebook_id: data.facebook_id,
        instagram_url: data.instagram_url,
        facebook_url: data.facebook_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return profile;
    }
  } catch (error: any) {
    const errorDetails = {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      status: error?.status,
      stack: error instanceof Error ? error.stack : undefined,
    };
    console.error('Error saving user profile:', errorDetails);
    // Re-throw with a meaningful message
    const message = error?.message || 'Failed to save profile';
    const fullError = new Error(message);
    Object.assign(fullError, errorDetails);
    throw fullError;
  }
};

export const uploadProfileImage = async (
  userId: string,
  file: File
): Promise<string | null> => {
  try {
    console.log('Uploading profile image for user:', userId);
    console.log('File details:', { name: file.name, size: file.size, type: file.type });

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 5MB limit`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `File type ${file.type} not allowed. Please upload JPEG, PNG, GIF, or WebP`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Try Edge Function first (if available), fall back to direct upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      console.log('Attempting to upload via Edge Function');

      const { data, error: functionError } = await supabase.functions.invoke(
        'upload-profile-image',
        {
          body: formData,
        }
      );

      if (!functionError && data?.success) {
        console.log('✅ Image uploaded successfully via Edge Function');
        return data.publicUrl;
      }

      console.log('Edge function unavailable, falling back to direct upload:', functionError);
    } catch (edgeFunctionError) {
      console.log('Edge function not available, falling back to direct upload:', edgeFunctionError);
    }

    // Fallback: Direct upload to storage (requires RLS to be disabled)
    console.log('Using direct storage upload');
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-images/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, {
        upsert: true,
        metadata: {
          user_id: userId
        }
      });

    if (uploadError) {
      const errorMsg = `Upload failed: ${uploadError.message || 'Unknown error'}`;
      console.error('Upload error:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ Image uploaded successfully via direct storage');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    console.log('Public URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error: any) {
    const errorMsg = error?.message || 'Failed to upload image. Please try again.';
    console.error('Error uploading profile image:', {
      message: errorMsg,
      fullError: error
    });
    throw new Error(errorMsg);
  }
};
