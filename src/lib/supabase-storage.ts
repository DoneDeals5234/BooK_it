import { supabase } from '@/lib/supabase';

export const uploadWebsiteImage = async (shopId: string, file: File) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `website-images/${fileName}`;

    // Try to upload
    const { data, error } = await supabase.storage
      .from('images') // Using a generic 'images' bucket as fallback
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      // If 'images' bucket doesn't exist, try 'profiles' bucket which often exists in these projects
      const { data: retryData, error: retryError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (retryError) throw retryError;
      
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);
        
      return urlData.publicUrl;
    }

    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};
export const uploadFile = async (bucket: string, path: string, file: File) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};
