import { supabase } from '@/lib/supabase';

export interface ShopCustomization {
  id?: string;
  shopId: string;
  backgroundColor: string; // Hex color like #ffffff
  primaryColor: string; // Accent color for buttons, highlights
  textColor: string; // Main text color
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'; // Border radius
  layoutStyle: 'compact' | 'spacious' | 'card-grid'; // Layout options
  cardStyle: 'flat' | 'elevated' | 'outlined'; // Card styling
  // Button Customization
  buttonCustomization?: {
    shape: 'rounded' | 'pill' | 'square'; // Button shape
    color: string; // Button color (hex)
    textColor: string; // Button text color (hex)
    size: 'sm' | 'md' | 'lg'; // Button size
    position: 'top' | 'bottom' | 'floating'; // Button position on page
  };
  enabledFeatures: {
    showTeam: boolean;
    showAbout: boolean;
    showChats: boolean;
    showReviews: boolean;
    showFeaturedProducts: boolean;
    showPrinting: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: number;
}

// Get customization for a shop from Supabase
export const getShopCustomization = async (
  shopId: string
): Promise<ShopCustomization | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_customizations')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is normal, return null
        return null;
      }
      console.error('Error fetching shop customization:', error.message || error);
      return null;
    }

    if (!data) return null;

    // Transform database format to interface format
    return {
      id: data.id,
      shopId: data.shop_id,
      backgroundColor: data.background_color,
      primaryColor: data.primary_color,
      textColor: data.text_color,
      borderRadius: data.border_radius,
      layoutStyle: data.layout_style,
      cardStyle: data.card_style,
      buttonCustomization: data.button_shape ? {
        shape: data.button_shape,
        color: data.button_color,
        textColor: data.button_text_color,
        size: data.button_size,
        position: data.button_position,
      } : undefined,
      enabledFeatures: {
        showTeam: data.show_team,
        showAbout: data.show_about,
        showChats: data.show_chats,
        showReviews: data.show_reviews,
        showFeaturedProducts: data.show_featured_products ?? true,
        showPrinting: data.show_printing ?? false,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastUpdated: data.last_updated ? parseInt(data.last_updated) : undefined,
    };
  } catch (error) {
    console.error('Error getting shop customization:', error);
    return null;
  }
};

// Save customization for a shop to Supabase
export const saveShopCustomization = async (
  customization: ShopCustomization
): Promise<boolean> => {
  try {
    const customizationData = {
      shop_id: customization.shopId,
      background_color: customization.backgroundColor,
      primary_color: customization.primaryColor,
      text_color: customization.textColor,
      border_radius: customization.borderRadius,
      layout_style: customization.layoutStyle,
      card_style: customization.cardStyle,
      button_shape: customization.buttonCustomization?.shape || 'rounded',
      button_color: customization.buttonCustomization?.color || '#3b82f6',
      button_text_color: customization.buttonCustomization?.textColor || '#ffffff',
      button_size: customization.buttonCustomization?.size || 'md',
      button_position: customization.buttonCustomization?.position || 'bottom',
      show_team: customization.enabledFeatures.showTeam,
      show_about: customization.enabledFeatures.showAbout,
      show_chats: customization.enabledFeatures.showChats,
      show_reviews: customization.enabledFeatures.showReviews,
      show_featured_products: customization.enabledFeatures.showFeaturedProducts,
      show_printing: customization.enabledFeatures.showPrinting,
      last_updated: Date.now(),
    };

    // Try to update first
    const { data: existingData, error: fetchError } = await supabase
      .from('shop_customizations')
      .select('id')
      .eq('shop_id', customization.shopId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      const errorMsg = fetchError instanceof Error ? fetchError.message : JSON.stringify(fetchError);
      console.error('Error checking existing customization:', errorMsg);
      return false;
    }

    if (existingData) {
      // Update existing record
      const { error } = await supabase
        .from('shop_customizations')
        .update(customizationData)
        .eq('shop_id', customization.shopId);

      if (error) {
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error updating shop customization:', errorMsg);
        return false;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('shop_customizations')
        .insert([customizationData]);

      if (error) {
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error inserting shop customization:', errorMsg);
        console.error('Attempted to insert:', customizationData);
        console.error('Shop ID:', customization.shopId);
        return false;
      }
    }

    console.log('✅ Shop customization saved successfully');
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error saving shop customization:', errorMsg);
    return false;
  }
};

// Delete customization for a shop
export const deleteShopCustomization = async (
  shopId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('shop_customizations')
      .delete()
      .eq('shop_id', shopId);

    if (error) {
      console.error('Error deleting shop customization:', error);
      return false;
    }

    console.log('✅ Shop customization deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting shop customization:', error);
    return false;
  }
};

// Get all customizations
export const getAllCustomizations = async (): Promise<
  ShopCustomization[]
> => {
  try {
    const { data, error } = await supabase
      .from('shop_customizations')
      .select('*');

    if (error) {
      console.error('Error fetching all customizations:', error);
      return [];
    }

    if (!data) return [];

    // Transform database format to interface format
    return data.map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      backgroundColor: item.background_color,
      primaryColor: item.primary_color,
      textColor: item.text_color,
      borderRadius: item.border_radius,
      layoutStyle: item.layout_style,
      cardStyle: item.card_style,
      buttonCustomization: item.button_shape ? {
        shape: item.button_shape,
        color: item.button_color,
        textColor: item.button_text_color,
        size: item.button_size,
        position: item.button_position,
      } : undefined,
      enabledFeatures: {
        showTeam: item.show_team,
        showAbout: item.show_about,
        showChats: item.show_chats,
        showReviews: item.show_reviews,
        showFeaturedProducts: item.show_featured_products ?? true,
        showPrinting: item.show_printing ?? false,
      },
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      lastUpdated: item.last_updated ? parseInt(item.last_updated) : undefined,
    }));
  } catch (error) {
    console.error('Error getting all customizations:', error);
    return [];
  }
};

// Convert customization to CSS variables for styling
export const customizationToCssVariables = (
  customization: ShopCustomization
): Record<string, string> => {
  const borderRadiusMap: Record<string, string> = {
    none: '0px',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  };

  const buttonShapeMap: Record<string, string> = {
    square: '0px',
    rounded: '0.375rem',
    pill: '9999px',
  };

  const buttonSizeMap: Record<string, string> = {
    sm: '0.5rem 0.75rem',
    md: '0.75rem 1.25rem',
    lg: '1rem 1.5rem',
  };

  return {
    '--shop-bg-color': customization.backgroundColor,
    '--shop-primary-color': customization.primaryColor,
    '--shop-text-color': customization.textColor,
    '--shop-border-radius': borderRadiusMap[customization.borderRadius],
    '--shop-button-color': customization.buttonCustomization?.color || '#3b82f6',
    '--shop-button-text-color': customization.buttonCustomization?.textColor || '#ffffff',
    '--shop-button-radius': buttonShapeMap[customization.buttonCustomization?.shape || 'rounded'],
    '--shop-button-padding': buttonSizeMap[customization.buttonCustomization?.size || 'md'],
    '--shop-button-position': customization.buttonCustomization?.position || 'bottom',
  };
};

// Get default customization
export const getDefaultCustomization = (shopId: string): ShopCustomization => {
  return {
    shopId,
    backgroundColor: '#ffffff',
    primaryColor: '#3b82f6',
    textColor: '#1f2937',
    borderRadius: 'md',
    layoutStyle: 'spacious',
    cardStyle: 'elevated',
    buttonCustomization: {
      shape: 'rounded',
      color: '#3b82f6',
      textColor: '#ffffff',
      size: 'md',
      position: 'bottom',
    },
    enabledFeatures: {
      showTeam: true,
      showAbout: true,
      showChats: true,
      showReviews: true,
      showFeaturedProducts: true,
      showPrinting: false,
    },
    lastUpdated: Date.now(),
  };
};
