import { supabase } from '@/lib/supabase';

export interface NativeShopOwner {
  id: string;
  shopId: string;
  userId: string;
  playerId: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Save or update native shop owner data
export const saveNativeShopOwner = async (
  shopId: string,
  userId: string,
  email: string,
  playerId?: string | null
): Promise<NativeShopOwner | null> => {
  try {
    // Check if native shop owner already exists
    const { data: existing, error: fetchError } = await supabase
      .from('native_shop_owners')
      .select('id')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing native shop owner:', fetchError);
      return null;
    }

    let result;
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('native_shop_owners')
        .update({
          player_id: playerId || null,
          email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating native shop owner:', error);
        return null;
      }
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('native_shop_owners')
        .insert({
          shop_id: shopId,
          user_id: userId,
          email,
          player_id: playerId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving native shop owner:', error);
        return null;
      }
      result = data;
    }

    if (!result) return null;

    return {
      id: result.id,
      shopId: result.shop_id,
      userId: result.user_id,
      playerId: result.player_id,
      email: result.email,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  } catch (error) {
    console.error('Error in saveNativeShopOwner:', error);
    return null;
  }
};

// Get native shop owner by user ID and shop ID
export const getNativeShopOwner = async (
  userId: string,
  shopId: string
): Promise<NativeShopOwner | null> => {
  try {
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('*')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching native shop owner:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      shopId: data.shop_id,
      userId: data.user_id,
      playerId: data.player_id,
      email: data.email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getNativeShopOwner:', error);
    return null;
  }
};

// Get all shops owned by a user
export const getNativeShopsByUserId = async (userId: string): Promise<NativeShopOwner[]> => {
  try {
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shops for user:', error);
      return [];
    }

    return (data || []).map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      userId: item.user_id,
      playerId: item.player_id,
      email: item.email,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  } catch (error) {
    console.error('Error in getNativeShopsByUserId:', error);
    return [];
  }
};

// Update player ID for native shop owner
export const updateNativeShopOwnerPlayerId = async (
  userId: string,
  shopId: string,
  playerId: string
): Promise<NativeShopOwner | null> => {
  try {
    const { data, error } = await supabase
      .from('native_shop_owners')
      .update({
        player_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      console.error('Error updating player ID:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      shopId: data.shop_id,
      userId: data.user_id,
      playerId: data.player_id,
      email: data.email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in updateNativeShopOwnerPlayerId:', error);
    return null;
  }
};

// Check if a shop owner already exists for a given shop ID
export const checkIfShopOwnerExists = async (shopId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Checking if shop owner exists for shop ID: ${shopId}`);
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('id')
      .eq('shop_id', shopId)
      .limit(1);

    if (error) {
      console.error('Error checking if shop owner exists:', error);
      return false;
    }

    const exists = data && data.length > 0;
    console.log(`${exists ? '⚠️ Shop owner already exists' : '✅ No shop owner exists'} for shop ${shopId}`);
    return exists;
  } catch (error) {
    console.error('Error in checkIfShopOwnerExists:', error);
    return false;
  }
};

// Get all native shop owners by shop ID
export const getNativeShopOwnersByShopId = async (shopId: string): Promise<NativeShopOwner[]> => {
  try {
    console.log(`🔍 Fetching native shop owners for shop ID: ${shopId}`);
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching native shop owners for shop:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`⚠️ No native shop owners found for shop ${shopId}`);
      return [];
    }

    console.log(`✅ Found ${data.length} native shop owner(s) for shop ${shopId}:`, JSON.stringify(data, null, 2));

    const mapped = (data || []).map((item) => {
      const mapped: NativeShopOwner = {
        id: item.id,
        shopId: item.shop_id,
        userId: item.user_id,
        playerId: item.player_id,
        email: item.email,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      };
      console.log(`📋 Mapped native shop owner: userId=${mapped.userId}, shopId=${mapped.shopId}, email=${mapped.email}`);
      return mapped;
    });

    console.log(`✅ Returning ${mapped.length} mapped native shop owner(s)`);
    return mapped;
  } catch (error) {
    console.error('Error in getNativeShopOwnersByShopId:', error);
    return [];
  }
};

// Get all native shop owners from the entire system
export const getAllNativeShopOwners = async (): Promise<NativeShopOwner[]> => {
  try {
    console.log(`🔍 Fetching all native shop owners from the system`);
    const { data, error } = await supabase
      .from('native_shop_owners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all native shop owners:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`⚠️ No native shop owners found in the system`);
      return [];
    }

    console.log(`✅ Found ${data.length} native shop owner(s) in total`);

    const mapped = (data || []).map((item) => {
      const mapped: NativeShopOwner = {
        id: item.id,
        shopId: item.shop_id,
        userId: item.user_id,
        playerId: item.player_id,
        email: item.email,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      };
      return mapped;
    });

    console.log(`✅ Returning ${mapped.length} mapped native shop owner(s)`);
    return mapped;
  } catch (error) {
    console.error('Error in getAllNativeShopOwners:', error);
    return [];
  }
};
