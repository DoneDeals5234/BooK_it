import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetch all available subscription plans
 */
export const getPlans = async (): Promise<Plan[]> => {
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, returning empty plans list');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('⚠️ Error fetching plans from Supabase:', JSON.stringify(error, null, 2));
      return [];
    }

    return (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || null,
      features: Array.isArray(item.features) ? item.features : [],
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  } catch (error) {
    console.error('Error in getPlans:', error);
    return [];
  }
};

/**
 * Fetch a specific plan by ID
 */
export const getPlanById = async (planId: string): Promise<Plan | null> => {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching plan:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || null,
      features: Array.isArray(data.features) ? data.features : [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getPlanById:', error);
    return null;
  }
};

/**
 * Fetch a specific plan by name
 */
export const getPlanByName = async (planName: string): Promise<Plan | null> => {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('name', planName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching plan by name:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || null,
      features: Array.isArray(data.features) ? data.features : [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error in getPlanByName:', error);
    return null;
  }
};
