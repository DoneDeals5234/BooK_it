import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getUserProfile, saveUserProfile, uploadProfileImage, type UserProfile } from '@/lib/supabase-user-profiles';

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  profileComplete: boolean;
  saveProfile: (name: string, phone: string, imageFile?: File, locationData?: {
    address?: string;
    village?: string;
    district?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    google_map_link?: string;
  }) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error('useUserProfile must be used within UserProfileProvider');
  return context;
};

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error loading profile:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (
    name: string,
    phone: string,
    imageFile?: File,
    locationData?: {
      address?: string;
      village?: string;
      district?: string;
      state?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      google_map_link?: string;
    }
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      let imageUrl: string | undefined;

      // Upload image if provided
      if (imageFile) {
        try {
          const uploadedUrl = await uploadProfileImage(user.uid, imageFile);
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
          } else {
            console.warn('Image upload returned null, but continuing to save profile with name and phone');
          }
        } catch (uploadError: any) {
          const errorMsg = uploadError?.message || 'Image upload failed';
          console.error('Image upload error:', errorMsg);
          // Re-throw to let ProfilePage handle it
          throw new Error(errorMsg);
        }
      }

      const savedProfile = await saveUserProfile(user.uid, name, phone, imageUrl, locationData);
      if (savedProfile) {
        setProfile(savedProfile);
        return true;
      }
      return false;
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to save profile';
      console.error('Error saving profile:', errorMsg);
      throw error;
    }
  };

  // Load profile when user changes
  useEffect(() => {
    refreshProfile();
  }, [user]);

  const profileComplete = profile !== null && profile.name && profile.phone;

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        loading,
        profileComplete,
        saveProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};
