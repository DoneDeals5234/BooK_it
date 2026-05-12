import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { isCapacitor } from '@/lib/capacitor-notifications';
import { auth } from '@/lib/firebase';
import { Preferences } from '@capacitor/preferences';
import { saveUserDevice, verifyUserDeviceCredentials, setUserOnlineStatus } from '@/lib/supabase-user-devices';
import { saveUserProfile } from '@/lib/supabase-user-profiles';
import { saveShopOwner, checkIfWebShopOwnerExists } from '@/lib/supabase-shop-owners';
import { saveNativeShopOwner, checkIfShopOwnerExists } from '@/lib/supabase-native-shop-owners';
import { linkNativeDeviceToUser } from '@/lib/supabase-native-devices';
import { syncPendingFcmToken } from '@/lib/fcm-manager';

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
  signUpAsShopOwner: (email: string, password: string, shopName: string, shopCategory: string, locationData?: LocationData, phone?: string, altPhone?: string, instagramId?: string, facebookId?: string) => Promise<void>;
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
        const userData = await aggregateUserDataAfterSignIn(userId, email);
        setAggregatedData(userData);

        if (userData.isShopOwner && userData.shopOwnerData) {
          setUserRole({
            type: 'shop_owner',
            shopId: userData.shopOwnerData.shopId
          });
          console.log('✅ Role set: shop_owner', userData.shopOwnerData.shopId);
        } else {
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
        syncPendingFcmToken(session.userId).catch((e) =>
          console.warn('⚠️ FCM token sync warning on session restore:', e)
        );
      } catch (e) {
        console.error('Error restoring session:', e);
        localStorage.removeItem('supabase_session');
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        syncPendingFcmToken(user.uid).catch((e) =>
          console.warn('⚠️ FCM token sync warning on Firebase auth state change:', e)
        );
      }
      setLoading(false);
    }, (error) => {
      console.error('Auth state change error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        // Link native device to user on login in native environment
        if (isCapacitor()) {
          try {
            console.log('🔗 Linking native device to user on login...');
            await linkNativeDeviceToUser(user.uid, user.email || '', null, 'native');
          } catch (e) {
            console.error('❌ Failed to link native device during login:', e);
          }
        }
        
        // Notify Kotlin bridge for Firebase-based logins
        try {
          const bridge = (window as any).AndroidBridge;
          if (bridge && typeof bridge.onUserLogin === 'function') {
            bridge.onUserLogin(user.uid, user.email || '');
          }
        } catch (e) {}

      } catch (e) {
        console.error('❌ Failed to handle auth state change:', e);
      }
    })();
  }, [user]);

  const signIn = async (email: string, password: string, locationData?: LocationData) => {
    try {
      console.log('🔍 Verifying credentials in Supabase user_devices table...');
      const verification = await verifyUserDeviceCredentials(email, password);

      if (verification.error) throw new Error(verification.error);

      if (!verification.isAvailable) {
        if (verification.userId) {
          try {
            await setUserOnlineStatus(verification.userId, true);
            localStorage.removeItem('supabase_session');
            setSupabaseUser(null);
          } catch (err) {}
        }
        throw new Error('This device is already logged in. Please sign out first or try again.');
      }

      const userId = verification.userId;
      if (!userId) throw new Error('Failed to retrieve user ID');

      await setUserOnlineStatus(userId, false);

      const sessionData = { userId, email };
      localStorage.setItem('supabase_session', JSON.stringify(sessionData));
      setSupabaseUser(sessionData);

      try {
        await Preferences.set({
          key: 'user_credentials',
          value: JSON.stringify({ email, password })
        });
      } catch (err) {}

      await aggregateUserDataAfterSignIn(userId, email).then(data => setAggregatedData(data)).catch(() => {});

      syncPendingFcmToken(userId).catch(() => {});

      try {
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.onUserLogin === 'function') {
          bridge.onUserLogin(userId, email);
        }
      } catch (err) {}

    } catch (e: any) {
      throw e;
    }
  };

  const signUp = async (email: string, password: string, locationData?: LocationData) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userId = cred.user.uid;
      const userEmail = cred.user.email ?? email;

      try {
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.onUserLogin === 'function') {
          bridge.onUserLogin(userId, userEmail, password);
        }
      } catch (e) {}

      await saveUserDataToSupabase(userId, userEmail, password, locationData);

      syncPendingFcmToken(userId).catch(() => {});

      try {
        await Preferences.set({
          key: 'user_credentials',
          value: JSON.stringify({ email, password })
        });
      } catch (err) {}
    } catch (e: any) {
      throw e;
    }
  };

  const saveUserDataToSupabase = async (userId: string, userEmail: string, password: string, locationData?: LocationData) => {
    try {
      await saveUserProfile(userId, '', '', undefined, { ...locationData, email: userEmail });
    } catch (e) {}

    if (!isCapacitor()) {
      try {
        await saveUserDevice({ userId, email: userEmail, password, playerId: null });
        await verifyAccountCreation(userId, userEmail, password || '');
      } catch (e) {}
    } else {
      try {
        await linkNativeDeviceToUser(userId, userEmail, password || null, 'native');
      } catch (e) {}
    }
  };

  const signInAsShopOwner = async (email: string, password: string, shopId: string, locationData?: LocationData) => {
    const ownerExists = isCapacitor()
      ? await checkIfShopOwnerExists(shopId)
      : await checkIfWebShopOwnerExists(shopId);

    if (ownerExists) throw new Error('A shop owner already exists for this shop.');

    const cred = await signInWithEmailAndPassword(auth, email, password);
    await saveShopOwnerDataToSupabase(shopId, cred.user.uid, cred.user.email || email, password, locationData);
  };

  const signUpAsShopOwner = async (email: string, password: string, shopName: string, shopCategory: string, locationData?: LocationData, phone?: string, altPhone?: string, instagramId?: string, facebookId?: string) => {
    let userId: string;
    let userEmail: string;

    if (auth.currentUser && auth.currentUser.email === email) {
      userId = auth.currentUser.uid;
      userEmail = auth.currentUser.email;
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      userId = cred.user.uid;
      userEmail = cred.user.email ?? email;

      try {
        const bridge = (window as any).AndroidBridge;
        if (bridge && typeof bridge.onUserLogin === 'function') {
          bridge.onUserLogin(userId, userEmail, password);
        }
      } catch (e) {}
    }

    const newShop = await addShop({
      name: shopName,
      location: locationData?.address || '',
      ownerName: userEmail.split('@')[0] || 'Shop Owner',
      ownerEmail: userEmail,
      ownerPhone: phone || '',
      alternativePhone: altPhone || '',
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
      instagramId: instagramId || '',
      facebookId: facebookId || '',
    } as any);

    if (!newShop) throw new Error('Failed to create shop.');

    await saveShopOwnerDataToSupabase(newShop.id, userId, userEmail, password, locationData);
  };

  const saveShopOwnerDataToSupabase = async (shopId: string, userId: string, userEmail: string, password?: string, locationData?: LocationData) => {
    try {
      await saveUserProfile(userId, '', '', undefined, { ...locationData, email: userEmail });
    } catch (e) {}

    if (isCapacitor()) {
      await saveNativeShopOwner(shopId, userId, userEmail, null);
      await linkNativeDeviceToUser(userId, userEmail, password || null, 'native');
    } else {
      await saveShopOwner(shopId, userId, userEmail, null);
      await saveUserDevice({ userId, email: userEmail, password: password || '', playerId: null });
      await verifyAccountCreation(userId, userEmail, password || '');
    }
  };

  const signOut = async () => {
    try {
      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.onUserLogout === 'function') {
        bridge.onUserLogout();
      }
    } catch (err) {}

    if (supabaseUser) {
      try {
        await setUserOnlineStatus(supabaseUser.userId, true);
      } catch (err) {}
      localStorage.removeItem('supabase_session');
      setSupabaseUser(null);
    }

    if (user) await firebaseSignOut(auth);

    setUserRole(null);
    setAggregatedData(null);
  };

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
