import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { retryWithBackoff } from '@/lib/retry-utils';
import { Category } from '@/types';

// Get all categories
export const getAllCategories = async (): Promise<Category[]> => {
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, returning empty categories list');
    return [];
  }

  // Check if browser has internet connection
  if (!navigator.onLine) {
    console.log('📡 No internet connection, returning empty categories list');
    return [];
  }

  try {
    console.log('📥 Fetching categories from Supabase...');
    const { data, error } = await retryWithBackoff(() =>
      supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })
    );

    if (error) {
      console.error('❌ Error fetching categories from Supabase:');
      console.error('  Message:', error.message || 'No message');
      console.error('  Code:', error.code || 'No code');
      console.error('  Details:', error.details || 'No details');
      console.error('  Hint:', error.hint || 'No hint');
      console.error('  Full error:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log('✅ Successfully fetched categories:', data?.length || 0);
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      icon: item.icon,
      description: item.description,
      displayOrder: item.display_order,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Failed to fetch categories after retries:', error instanceof Error ? error.message : error);
    return [];
  }
};

// Get a single category by slug
export const getCategoryBySlug = async (slug: string): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error('Error fetching category:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    icon: data.icon,
    description: data.description,
    displayOrder: data.display_order,
    createdAt: new Date(data.created_at),
  };
};

// Get a single category by ID
export const getCategoryById = async (id: string): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching category:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    icon: data.icon,
    description: data.description,
    displayOrder: data.display_order,
    createdAt: new Date(data.created_at),
  };
};
