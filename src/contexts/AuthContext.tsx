import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { isCapacitor } from '@/lib/capacitor-notifications';
import { Dialog } from '@capacitor/dialog';
import { auth } from '@/lib/firebase';
import { Preferences } from '@capacitor/preferences';
import { saveUserDevice, getUserDevicePassword, updateUserDevicePassword, verifyUserDeviceCredentials, setUserOnlineStatus } from '@/lib/supabase-user-devices';
import { saveUserProfile } from '@/lib/supabase-user-profiles';
import { saveShopOwner, checkIfWebShopOwnerExists, getShopsByUserId } from '@/lib/supabase-shop-owners';
import { saveNativeShopOwner, checkIfShopOwnerExists, getNativeShopsByUserId } from '@/lib/supabase-native-shop-owners';
import { ensurePushSubscribed } from '@/lib/onesignal-messaging';
import { linkNativeDeviceToUser } from '@/lib/supabase-native-devices';
import { linkDeviceToUserViaOneSignal } from '@/lib/capacitor-notifications';
import { setOneSignalUserIdTag } from '@/lib/onesignal-messaging';
import { addShop } from '@/lib/shops-storage';
import { aggregateUserDataAfterSignIn, type AggregatedUserData } from '@/lib/user-data-aggregation';
import { verifyAccountCreation } from '@/lib/account-verification';

export interface UserRole {
  type: 'regular' | 'shop_owner';
  shopId?: string;
}

export interface LocationData {
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  roleLoading: boolean;
  aggregatedData: AggregatedUserData | null;
  signIn: (email: string, password: string, locationData?: LocationData) => Promise<void>;
  signUp: (email: string, password: string, locationData?: LocationData) => Promise<void>;
  signInAsShopOwner: (email: string, password: string, shopId: string, locationData?: LocationData) => Promise<void>;
  signUpAsShopOwner: (email: string, password: string, shopName: string, shopCategory: string, locationData?: LocationData) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<AggregatedUserData | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<{ userId: string; email: string } | null>(null);

  // Unify user role fetching for both Firebase and Supabase users
  useEffect(() => {
    const effectiveUser = user || (supabaseUser ? { uid: supabaseUser.userId, email: supabaseUser.email } : null);

    if (!effectiveUser) {
      // Only reset if no authentication exists at all
      if (!loading) {
        setUserRole(null);
        setAggregatedData(null);
      }
      return;
    }

    const fetchUserRoleAndData = async () => {
      setRoleLoading(true);
      try {
        const userId = (effectiveUser as any).uid || (effectiveUser as any).userId;
        const email = (effectiveUser as any).email;

        if (!userId || !email) {
          setUserRole({ type: 'regular' });
          return;
        }

        console.log('🔄 Fetching user role and aggregating data for:', userId);

        // Use the aggregate function which already checks all role tables and fallback logic
        const userData = await aggregateUserDataAfterSignIn(userId, email);
        setAggregatedData(userData);

        if (userData.isShopOwner && userData.shopOwnerData) {
          // User is a shop owner
          setUserRole({
            type: 'shop_owner',
            shopId: userData.shopOwnerData.shopId
          });
          console.log('✅ Role set: shop_owner', userData.shopOwnerData.shopId);
        } else {
          // User is a regular user
          setUserRole({ type: 'regular' });
          console.log('✅ Role set: regular');
        }
      } catch (error) {
        console.error('Error fetching user role/data:', error);
        setUserRole({ type: 'regular' });
      } finally {
        setRoleLoading(false);
      }
    };

    fetchUserRoleAndData();
  }, [user, supabaseUser, loading]);

  // Check for stored Supabase session on load
  useEffect(() => {
    const storedSession = localStorage.getItem('supabase_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        setSupabaseUser(session);
        console.log('✅ Restored Supabase session for user:', session.userId);
      } catch (e) {
        console.error('Error restoring session:', e);
        localStorage.removeItem('supabase_session');
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (error) => {
      console.error('Auth state change error:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      });
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        // ✅ Notify Kotlin bridge for Firebase-based logins (shop owners)
        // This ensures player_id gets captured natively even for Firebase auth
        try {
          const bridge = (window as any).AndroidBridge;
          if (bridge && typeof bridge.onUserLogin === 'function') {
            bridge.onUserLogin(user.uid, user.email || '');
            console.log('✅ AndroidBridge.onUserLogin() called for Firebase user:', user.uid);
          }
        } catch (bridgeError) {
          console.warn('⚠️ AndroidBridge not available (web):', bridgeError);
        }

        if (!isCapacitor()) {
          // For web environment, use ensurePushSubscribed which handles saving
          try {
            await ensurePushSubscribed();
          } catch (e) {
            console.error('Failed to ensure push subscription:', e);
          }
        } else {
          // For native environment, link device to user on login
          try {
            console.log('🔗 Linking native device to user on login...');
            
            // Step 1: Link in Supabase (database record)
            // ✅ Fix: Pass null for password since we don't have it here
            const nativeLinkSuccess = await linkNativeDeviceToUser(user.uid, user.email || '', null, 'native');
            if (nativeLinkSuccess) {
              console.log('✅ Native device linked to user in Supabase');
            }
            
            // Step 2: Link in OneSignal (External ID / Identity)
            const oneSignalLinkSuccess = await linkDeviceToUserViaOneSignal(user.uid);
            if (oneSignalLinkSuccess) {
              console.log('✅ Native device linked to OneSignal identity');
            }
          } catch (e) {
            console.error('❌ Failed to link native device during login:', e);
          }
        }
      } catch (e) {
        console.error('❌ Failed to handle auth state change:', e);
      }
    })();
  }, [user]);

  const signIn = async (email: string, password: string, locationData?: LocationData) => {
    try {
      // 1. Verify credentials ONLY from Supabase user_devices table
      console.log('🔍 Verifying credentials in Supabase user_devices table...');
      const verification = await verifyUserDeviceCredentials(email, password);

      if (verification.error) {
        throw new Error(verification.error);
      }

      if (!verification.isAvailable) {
        // Device is already logged in - provide helpful error with recovery option
        console.warn('⚠️ Device is already logged in, attempting to force logout and retry...');

        // Try to force logout this device first
        if (verification.userId) {
          try {
            console.log('🔄 Forcing logout of existing session...');
            await setUserOnlineStatus(verification.userId, true);
            console.log('✅ Existing session cleared');

            // Clear localStorage to ensure clean state
            localStorage.removeItem('supabase_session');
            setSupabaseUser(null);
          } catch (forcedLogoutError) {
            console.error('⚠️ Could not force logout:', forcedLogoutError);
          }
        }

        throw new Error('This device is already logged in. Please sign out first or try again.');
      }

      const userId = verification.userId;
      if (!userId) {
        throw new Error('Failed to retrieve user ID');
      }

      // 2. Mark device as not available (logged in) in Supabase
      console.log('📝 Marking device as logged in...');
      await setUserOnlineStatus(userId, false);

      // 3. Store session in localStorage and state
      const sessionData = { userId, email };
      localStorage.setItem('supabase_session', JSON.stringify(sessionData));
      setSupabaseUser(sessionData);

      // 3.5 Store credentials locally on device
      try {
        await Preferences.set({
          key: 'user_credentials',
          value: JSON.stringify({ email, password })
        });
        console.log('✅ Credentials stored locally on device');
      } catch (prefError) {
        console.error('⚠️ Failed to store credentials locally:', prefError);
      }

      // 4. Aggregate all user-linked data (shop owner status, plan, etc.)
      console.log('📊 Aggregating user data...');
      try {
        const userData = await aggregateUserDataAfterSignIn(userId, email);
        setAggregatedData(userData);
        console.log('✅ User data aggregated:', userData);
      } catch (aggregationError) {
        console.error('⚠️ Error aggregating user data:', aggregationError);
        // Continue login even if aggregation fails
      }

      console.log('✅ Login successful! Device marked as logged in.');
      console.log('User ID:', userId);
      console.log('Email:', email);

      // ✅ Notify Kotlin bridge → triggers native player_id capture & Supabase save
      try {
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.onUserLogin === 'function') {
          bridge.onUserLogin(userId, email, password); // Pass password
          console.log('✅ AndroidBridge.onUserLogin() called for Kotlin player_id capture');
          
          // Trigger notification permission prompt
          if (typeof bridge.promptForNotifications === 'function') {
            bridge.promptForNotifications();
          }
        }
      } catch (bridgeError) {
        console.warn('⚠️ AndroidBridge.onUserLogin not available (web?):', bridgeError);
      }

    } catch (e: any) {
      console.error('Sign in error:');
      console.error('  Code:', e?.code || 'unknown');
      console.error('  Message:', e?.message || String(e));
      console.error('  Details:', e?.details || 'No details');
      console.error('  Full error:', JSON.stringify(e, null, 2));
      throw e;
    }
  };

  const signUp = async (email: string, password: string, locationData?: LocationData) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userId = cred.user.uid;
      const userEmail = cred.user.email ?? email;

      // Notify Kotlin bridge for immediate player_id capture during signup
      try {
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.onUserLogin === 'function') {
          bridge.onUserLogin(userId, userEmail, password);
          console.log('✅ AndroidBridge.onUserLogin() called during signUp');
          
          // Trigger notification permission prompt
          if (typeof bridge.promptForNotifications === 'function') {
            bridge.promptForNotifications();
          }
        }
      } catch (e) {
        console.warn('Bridge not available during signUp:', e);
      }

      await saveUserDataToSupabase(userId, userEmail, password, locationData);

      // Store credentials locally on device
      try {
        await Preferences.set({
          key: 'user_credentials',
          value: JSON.stringify({ email, password })
        });
        console.log('✅ Credentials stored locally on device after signup');
      } catch (prefError) {
        console.error('⚠️ Failed to store credentials locally:', prefError);
      }
    } catch (e: any) {
      console.error('Sign up error:', {
        code: e?.code || 'unknown',
        message: e?.message || String(e),
        details: e
      });
      throw e;
    }
  };

  const saveUserDataToSupabase = async (userId: string, userEmail: string, password: string, locationData?: LocationData) => {
    // First, save user profile with location data if provided
    try {
      console.log('💾 Saving user profile...');
      await saveUserProfile(userId, '', '', undefined, locationData);
      console.log('✅ User profile saved successfully');
    } catch (e: any) {
      console.error('⚠️ Failed to save user profile:', {
        message: e.message || String(e),
        code: e.code
      });
      // Continue with other operations even if profile save fails
    }

    // For web environment
    if (!isCapacitor()) {
      try {
        await saveUserDevice({ userId, email: userEmail, password, playerId: null });

        // Verify account was stored securely
        const verificationResult = await verifyAccountCreation(userId, userEmail, password || '');
        if (verificationResult.verified) {
          console.log('✅ User account verified and stored securely:', verificationResult.message);
        } else {
          console.warn('⚠️ Account verification warning:', verificationResult.message);
        }

        try {
          await ensurePushSubscribed();
        } catch (e: any) {
          console.error('Failed to ensure push subscription:', {
            message: e.message || String(e)
          });
        }

        // Set OneSignal tag for web users so notifications can be sent by user ID
        console.log('🏷️ Setting OneSignal tag for web user:', userId);
        try {
          const tagSuccess = await setOneSignalUserIdTag(userId);
          if (tagSuccess) {
            console.log('✅ OneSignal tag set successfully for web user:', userId);
          } else {
            console.warn('⚠️ Failed to set OneSignal tag for web user, but continuing');
          }
        } catch (e: any) {
          console.error('Failed to set OneSignal tag:', {
            message: e.message || String(e)
          });
        }
      } catch (e: any) {
        console.error('Failed to save user device:', {
          message: e.message || String(e)
        });
      }
    } else {
      // For native environment (Android/iOS)
      // Step 1: Link device to Supabase user record
      console.log('📱 Running in native environment, linking native device to user...');
      try {
        console.log('🔗 Linking native device to user in Supabase...');        
        try {
          const success = await linkNativeDeviceToUser(userId, userEmail, password || null, 'native');
          if (success) {
            console.log('✅ Native device linked successfully');
          } else {
            console.error('❌ Native device linking failed');
            await Dialog.alert({
              title: 'Device Sync Error',
              message: 'Could not sync your device for notifications. Please try logging in again later.',
            });
          }
        } catch (e) {
          console.error('❌ Error linking device:', e);
          await Dialog.alert({
            title: 'Connection Error',
            message: 'Failed to connect to notification server.',
          });
        }
      } catch (e: any) {
        console.error('❌ Failed to link native device:', {
          message: e.message || String(e)
        });
      }

      // Step 2: Link device to OneSignal with External ID (user_id)
      // This is critical - OneSignal.login(userId) must be called on the device
      console.log('🔗 Linking device to OneSignal with External ID (user_id)...');
      try {
        const success = await linkDeviceToUserViaOneSignal(userId);
        if (success) {
          console.log('✅ Device linked to OneSignal with External ID and tag:', userId);
        } else {
          console.warn('⚠️ Failed to link device to OneSignal, continuing anyway');
        }
      } catch (e: any) {
        console.error('❌ Error linking device to OneSignal:', {
          message: e.message || String(e)
        });
      }
    }
  };


  const signInAsShopOwner = async (email: string, password: string, shopId: string, locationData?: LocationData) => {
    try {
      // Check if a shop owner already exists for this shop ID
      const isNativeEnvironment = isCapacitor();
      const ownerExists = isNativeEnvironment
        ? await checkIfShopOwnerExists(shopId)
        : await checkIfWebShopOwnerExists(shopId);

      if (ownerExists) {
        throw new Error('A shop owner already exists for this shop. Only one shop owner is allowed per shop.');
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userId = cred.user.uid;
      const userEmail = cred.user.email ?? email;

      await saveShopOwnerDataToSupabase(shopId, userId, userEmail, password, locationData);
    } catch (e: any) {
      console.error('Shop owner sign in error:', {
        code: e.code,
        message: e.message,
        email
      });
      throw e;
    }
  };

  const signUpAsShopOwner = async (email: string, password: string, shopName: string, shopCategory: string, locationData?: LocationData) => {
    try {
      let userId: string;
      let userEmail: string;

      // Check if user is already logged in and it matches the email
      if (auth.currentUser && auth.currentUser.email === email) {
        console.log('👤 User is already logged in, using existing account');
        userId = auth.currentUser.uid;
        userEmail = auth.currentUser.email;
      } else {
        // Create Firebase account if not logged in or different email
        console.log('🆕 Creating new Firebase account for shop owner...');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        userId = cred.user.uid;
        userEmail = cred.user.email ?? email;

        // Notify Kotlin bridge for shop owner signup
        try {
          const bridge = (window as any).AndroidBridge;
          if (bridge && typeof bridge.onUserLogin === 'function') {
            bridge.onUserLogin(userId, userEmail, password);
            console.log('✅ AndroidBridge.onUserLogin() called during signUpAsShopOwner');
            
            // Trigger notification permission prompt
            if (typeof bridge.promptForNotifications === 'function') {
              bridge.promptForNotifications();
            }
          }
        } catch (e) {
          console.warn('Bridge not available during shop owner signUp:', e);
        }
      }

      // Create the shop automatically with provided name and category
      console.log('📦 Creating shop automatically for owner...');
      const newShop = await addShop({
        name: shopName,
        location: locationData?.address || '',
        ownerName: userEmail.split('@')[0] || 'Shop Owner',
        ownerEmail: userEmail,
        ownerPhone: '',
        about: '',
        shopImageUrl: '',
        locationImageUrl: '',
        locationMapLink: '',
        latitude: locationData?.latitude || null,
        longitude: locationData?.longitude || null,
        address: locationData?.address || null,
        village: locationData?.street || null,
        district: '',
        state: locationData?.state || null,
        country: locationData?.country || null,
        barberMembers: [],
        services: [],
        password: password,
        openingTime: '09:00',
        closingTime: '18:00',
        category: shopCategory.toLowerCase(),
      });

      if (!newShop) {
        throw new Error('Failed to create shop. Please try again.');
      }

      console.log('✅ Shop created successfully:', newShop.id);

      // Now save the shop owner data
      await saveShopOwnerDataToSupabase(newShop.id, userId, userEmail, password, locationData);
    } catch (e: any) {
      console.error('Shop owner sign up error:', {
        code: e?.code || 'unknown',
        message: e?.message || String(e),
        details: e
      });
      throw e;
    }
  };

  const saveShopOwnerDataToSupabase = async (shopId: string, userId: string, userEmail: string, password?: string, locationData?: LocationData) => {
    try {
      console.log('💼 Saving shop owner data for shop:', shopId);

      // First, save user profile with location data if provided
      try {
        console.log('💾 Saving shop owner profile...');
        await saveUserProfile(userId, '', '', undefined, locationData);
        console.log('✅ Shop owner profile saved successfully');
      } catch (e) {
        console.error('⚠️ Failed to save shop owner profile:', e);
        // Continue with other operations even if profile save fails
      }

      // For native environment, save to native_shop_owners table
      if (isCapacitor()) {
        console.log('📱 Running in native environment, saving to native_shop_owners table...');

        try {
          await saveNativeShopOwner(shopId, userId, userEmail, null);
          console.log('✅ Shop owner data saved to native_shop_owners');
        } catch (e) {
          console.error('❌ Failed to save shop owner to native_shop_owners:', e);
          throw e;
        }

        // Step 2: Link device to Supabase user record
        try {
          console.log('🔗 Linking native device to shop owner in Supabase...');
          // ✅ Fix: Pass password if available, otherwise null
          const success = await linkNativeDeviceToUser(userId, userEmail, password || null, 'native');
          if (success) {
            console.log('✅ Shop owner native device linked');
          } else {
            console.error('❌ Failed to link shop owner native device');
          }
        } catch (e) {
          console.error('⚠️ Failed to link shop owner to native_devices:', e);
        }

        // Step 3: Ensure OneSignal subscription is initialized
        console.log('🔔 Ensuring OneSignal subscription is initialized...');
        try {
          await ensurePushSubscribed();
          console.log('✅ OneSignal subscription initialized for shop owner');
        } catch (e) {
          console.error('⚠️ Failed to ensure push subscription:', e);
        }

        // Step 4: Link device to OneSignal with External ID (user_id)
        console.log('🔗 Linking shop owner device to OneSignal with External ID (user_id)...');
        try {
          const success = await linkDeviceToUserViaOneSignal(userId);
          if (success) {
            console.log('✅ Shop owner device linked to OneSignal with External ID and tag:', userId);
          } else {
            console.warn('⚠️ Failed to link shop owner device to OneSignal, continuing anyway');
          }
        } catch (e) {
          console.error('❌ Error linking shop owner device to OneSignal:', e);
        }
      } else {
        // For web environment, save to both shop_owners and user_devices
        console.log('🌐 Running in web environment, saving to shop_owners and user_devices tables...');

        try {
          await saveShopOwner(shopId, userId, userEmail, null);
          console.log('✅ Shop owner data saved to shop_owners');
        } catch (e) {
          console.error('❌ Failed to save shop owner to shop_owners:', e);
          throw e;
        }

        // Also save to user_devices for web notifications
        try {
          await saveUserDevice({
            userId,
            email: userEmail,
            password: password || '',
            playerId: null
          });
          console.log('✅ Web shop owner device saved to user_devices');

          // Verify account was stored securely
          const verificationResult = await verifyAccountCreation(userId, userEmail, password || '');
          if (verificationResult.verified) {
            console.log('✅ Account verified and stored securely:', verificationResult.message);
          } else {
            console.warn('⚠️ Account verification warning:', verificationResult.message);
          }
        } catch (e) {
          console.error('⚠️ Failed to save shop owner to user_devices:', e);
        }

        // Ensure OneSignal subscription is initialized for web shop owners
        console.log('🔔 Ensuring OneSignal subscription is initialized for web shop owner...');
        try {
          await ensurePushSubscribed();
          console.log('✅ OneSignal subscription initialized for web shop owner');
        } catch (e) {
          console.error('⚠️ Failed to ensure push subscription for web shop owner:', e);
        }

        // Set OneSignal tag for web shop owners
        console.log('🏷️ Setting OneSignal tag for web shop owner:', userId);
        try {
          const tagSuccess = await setOneSignalUserIdTag(userId);
          if (tagSuccess) {
            console.log('✅ OneSignal tag set successfully for web shop owner:', userId);
          } else {
            console.warn('⚠️ Failed to set OneSignal tag for web shop owner, but continuing');
          }
        } catch (e) {
          console.error('Failed to set OneSignal tag:', e);
        }
      }
    } catch (e) {
      console.error('❌ Error in saveShopOwnerDataToSupabase:', e);
      throw e;
    }
  };



  const signOut = async () => {
    // ✅ Notify Kotlin bridge about logout → clears OneSignal External ID
    try {
      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.onUserLogout === 'function') {
        bridge.onUserLogout();
        console.log('✅ AndroidBridge.onUserLogout() called');
      }
    } catch (bridgeError) {
      console.warn('⚠️ AndroidBridge.onUserLogout not available:', bridgeError);
    }

    // Handle Supabase user sign out
    if (supabaseUser) {
      try {
        await setUserOnlineStatus(supabaseUser.userId, true);
        console.log('✅ Marked device as available (logged out) in Supabase');
      } catch (e) {
        console.error('Failed to set user availability status during sign out:', e);
      }
      localStorage.removeItem('supabase_session');
      setSupabaseUser(null);
    }

    // Handle Firebase user sign out
    if (user) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error('Failed to sign out from Firebase:', e);
      }
    }

    setUserRole(null);
    setAggregatedData(null);
  };

  // User is logged in if either Firebase user or Supabase user exists
  const isLoggedIn = !!user || !!supabaseUser;

  return (
    <AuthContext.Provider value={{
      user: user || (supabaseUser ? { uid: supabaseUser.userId, email: supabaseUser.email } as any : null),
      loading,
      userRole,
      roleLoading,
      aggregatedData,
      signIn,
      signUp,
      signInAsShopOwner,
      signUpAsShopOwner,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};
