import { supabase } from '@/lib/supabase';

export interface ShopOwner {
  id: string;
  shopId: string;
  userId: string;
  playerId: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Save or update shop owner data
export const saveShopOwner = async (
  shopId: string,
  userId: string,
  email: string,
  playerId?: string | null
): Promise<ShopOwner | null> => {
  try {
    // Check if shop owner already exists
    const { data: existing, error: fetchError } = await supabase
      .from('shop_owners')
      .select('id')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing shop owner:', fetchError);
      return null;
    }

    let result;
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('shop_owners')
        .update({
          player_id: playerId || null,
          email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating shop owner:', error);
        return null;
      }
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('shop_owners')
        .insert({
          shop_id: shopId,
          user_id: userId,
          email,
          player_id: playerId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving shop owner:', error);
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
    console.error('Error in saveShopOwner:', error);
    return null;
  }
};

// Get shop owner by user ID and shop ID
export const getShopOwner = async (
  userId: string,
  shopId: string
): Promise<ShopOwner | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_owners')
      .select('*')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching shop owner:', error);
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
    console.error('Error in getShopOwner:', error);
    return null;
  }
};

// Get all shops owned by a user
export const getShopsByUserId = async (userId: string): Promise<ShopOwner[]> => {
  try {
    const { data, error } = await supabase
      .from('shop_owners')
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
    console.error('Error in getShopsByUserId:', error);
    return [];
  }
};

// Update player ID for shop owner
export const updateShopOwnerPlayerId = async (
  userId: string,
  shopId: string,
  playerId: string
): Promise<ShopOwner | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_owners')
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
    console.error('Error in updateShopOwnerPlayerId:', error);
    return null;
  }
};

// Check if a shop owner already exists for a given shop ID
export const checkIfWebShopOwnerExists = async (shopId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Checking if web shop owner exists for shop ID: ${shopId}`);
    const { data, error } = await supabase
      .from('shop_owners')
      .select('id')
      .eq('shop_id', shopId)
      .limit(1);

    if (error) {
      console.error('Error checking if web shop owner exists:', error);
      return false;
    }

    const exists = data && data.length > 0;
    console.log(`${exists ? '⚠️ Web shop owner already exists' : '✅ No web shop owner exists'} for shop ${shopId}`);
    return exists;
  } catch (error) {
    console.error('Error in checkIfWebShopOwnerExists:', error);
    return false;
  }
};

// Get all shop owners by shop ID
export const getShopOwnersByShopId = async (shopId: string): Promise<ShopOwner[]> => {
  try {
    const { data, error } = await supabase
      .from('shop_owners')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shop owners for shop:', error);
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
    console.error('Error in getShopOwnersByShopId:', error);
    return [];
  }
};
