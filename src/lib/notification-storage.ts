import { supabase } from '@/lib/supabase';

/**
 * Upload notification image to Supabase Storage and get public URL
 */
export async function uploadNotificationImage(file: File): Promise<string> {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `notification-${timestamp}-${randomId}.${extension}`;

    console.log('📤 Uploading image to Supabase Storage:', {
      fileName,
      fileSize: `${(file.size / 1024).toFixed(2)}KB`,
      fileType: file.type,
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('notifications')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('✅ Image uploaded:', data);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('notifications')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    console.log('🔗 Public URL:', publicUrl);

    if (!publicUrl) {
      throw new Error('Could not generate public URL');
    }

    return publicUrl;
  } catch (error) {
    console.error('❌ Notification image upload error:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Delete notification image from Supabase Storage (cleanup)
 */
export async function deleteNotificationImage(fileName: string): Promise<void> {
  try {
    console.log('🗑️ Deleting notification image:', fileName);

    const { error } = await supabase.storage
      .from('notifications')
      .remove([fileName]);

    if (error) {
      console.warn('⚠️ Delete error:', error);
      return;
    }

    console.log('✅ Image deleted successfully');
  } catch (error) {
    console.warn('⚠️ Could not delete image:', error);
    // Don't throw - cleanup errors shouldn't block notification sending
  }
}

/**
 * Extract filename from public URL
 */
export function extractFileNameFromUrl(url: string): string {
  try {
    const parts = url.split('/');
    return parts[parts.length - 1];
  } catch {
    return '';
  }
}
