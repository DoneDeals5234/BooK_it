import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Shop, BarberMember, Service } from '@/lib/shops-storage';
import { sanitizeSupabaseUrl } from '@/lib/utils';

export const getAllShopsFromSupabase = async (): Promise<Shop[]> => {
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, returning empty shops list');
    return [];
  }

  // Check if browser has internet connection
  if (!navigator.onLine) {
    console.log('📡 No internet connection, returning empty shops list');
    return [];
  }

  try {
    console.log('📥 Fetching shops from Supabase...');
    const { data, error } = await supabase
      .from('shops')
      .select(
        'id,name,location,owner_name,owner_email,owner_phone,about,' +
        'shop_image_url,shop_interior_video_url,location_image_url,location_map_link,' +
        'latitude,longitude,address,village,district,state,country,' +
        'password,barber_members,services,is_open,token_booking_paused,' +
        'opening_time,closing_time,category,category_id,created_at,' +
        'last_ping_time,display_status,is_pinned,pin_order,' +
        'is_website_builder_enabled,upi_id,advance_payment_mode'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching shops from Supabase:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2)
      });
      return [];
    }

    console.log('✅ Successfully fetched shops:', data?.length || 0);

    return (data || []).map((item) => {
      const barberMembers = typeof item.barber_members === 'string' ? JSON.parse(item.barber_members) : item.barber_members || [];
      const sanitizedBarberMembers = barberMembers.map((bm: any) => ({
        ...bm,
        imageUrl: sanitizeSupabaseUrl(bm.imageUrl)
      }));

      return {
        id: item.id,
        name: item.name,
        location: item.location,
        ownerName: item.owner_name,
        ownerEmail: item.owner_email,
        ownerPhone: item.owner_phone,
        about: item.about,
        shopImageUrl: sanitizeSupabaseUrl(item.shop_image_url),
        shopInteriorVideoUrl: sanitizeSupabaseUrl(item.shop_interior_video_url),
        locationImageUrl: sanitizeSupabaseUrl(item.location_image_url),
        locationMapLink: item.location_map_link,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        address: item.address || null,
        village: item.village || null,
        district: item.district || null,
        state: item.state || null,
        country: item.country || null,
        password: item.password,
        barberMembers: sanitizedBarberMembers,
        services: typeof item.services === 'string' ? JSON.parse(item.services) : item.services || [],
        isOpen: item.is_open,
        tokenBookingPaused: item.token_booking_paused,
        openingTime: item.opening_time || '09:00',
        closingTime: item.closing_time || '18:00',
        category: item.category || 'salon',
        createdAt: new Date(item.created_at),
        lastPingTime: item.last_ping_time ? new Date(item.last_ping_time) : null,
        displayStatus: item.display_status || 'offline',
        isPinned: item.is_pinned || false,
        pinOrder: item.pin_order || 999,
        isWebsiteBuilderEnabled: item.is_website_builder_enabled !== false,
        isTokenBookingEnabled: item.token_booking_paused !== true,
        upiId: item.upi_id,
        advancePaymentMode: item.advance_payment_mode || 'none',
      };
    });
  } catch (error) {
    console.error('Error in getAllShopsFromSupabase:', error);
    return [];
  }
};

export const getShopByIdFromSupabase = async (id: string): Promise<Shop | null> => {
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching shop from Supabase:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) return null;

    const barberMembers = typeof data.barber_members === 'string' ? JSON.parse(data.barber_members) : data.barber_members || [];
    const sanitizedBarberMembers = barberMembers.map((bm: any) => ({
      ...bm,
      imageUrl: sanitizeSupabaseUrl(bm.imageUrl)
    }));

    return {
      id: data.id,
      name: data.name,
      location: data.location,
      ownerName: data.owner_name,
      ownerEmail: data.owner_email,
      ownerPhone: data.owner_phone,
      about: data.about,
      shopImageUrl: sanitizeSupabaseUrl(data.shop_image_url),
      shopInteriorVideoUrl: sanitizeSupabaseUrl(data.shop_interior_video_url),
      locationImageUrl: sanitizeSupabaseUrl(data.location_image_url),
      locationMapLink: data.location_map_link,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      address: data.address || null,
      street: data.street || null,
      district: data.district || null,
      state: data.state || null,
      country: data.country || null,
      password: data.password,
      barberMembers: sanitizedBarberMembers,
      services: typeof data.services === 'string' ? JSON.parse(data.services) : data.services || [],
      isOpen: data.is_open,
      tokenBookingPaused: data.token_booking_paused,
      openingTime: data.opening_time || '09:00',
      closingTime: data.closing_time || '18:00',
      category: data.category || 'salon',
      createdAt: new Date(data.created_at),
      lastPingTime: data.last_ping_time ? new Date(data.last_ping_time) : null,
      displayStatus: data.display_status || 'offline',
      isPinned: data.is_pinned || false,
      pinOrder: data.pin_order || 999,
      isWebsiteBuilderEnabled: data.is_website_builder_enabled !== false,
      isTokenBookingEnabled: data.token_booking_paused !== true,
      upiId: data.upi_id,
      advancePaymentMode: data.advance_payment_mode || 'none',
    };
  } catch (error) {
    console.error('Error in getShopByIdFromSupabase:', error);
    return null;
  }
};

export const addShopToSupabase = async (
  shop: Omit<Shop, 'id' | 'createdAt' | 'isOpen' | 'tokenBookingPaused'>
): Promise<Shop | null> => {
  try {
    const shopId = Date.now().toString();

    const { data, error } = await supabase
      .from('shops')
      .insert({
        id: shopId,
        name: shop.name,
        location: shop.location,
        owner_name: shop.ownerName,
        owner_email: shop.ownerEmail,
        owner_phone: shop.ownerPhone,
        about: shop.about,
        shop_image_url: shop.shopImageUrl,
        shop_interior_video_url: shop.shopInteriorVideoUrl || null,
        location_image_url: shop.locationImageUrl,
        location_map_link: shop.locationMapLink,
        latitude: shop.latitude || null,
        longitude: shop.longitude || null,
        address: shop.address || null,
        village: shop.village || null,
        district: shop.district || null,
        state: shop.state || null,
        country: shop.country || null,
        password: shop.password,
        barber_members: JSON.stringify(shop.barberMembers),
        services: JSON.stringify(shop.services),
        is_open: true,
        token_booking_paused: false,
        opening_time: shop.openingTime || '09:00',
        closing_time: shop.closingTime || '18:00',
        category: shop.category || 'salon',
        display_status: 'offline',
        is_website_builder_enabled: true,
        upi_id: shop.upiId || null,
        advance_payment_mode: shop.advancePaymentMode || 'none',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding shop to Supabase:', JSON.stringify(error, null, 2));
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      location: data.location,
      ownerName: data.owner_name,
      ownerEmail: data.owner_email,
      ownerPhone: data.owner_phone,
      about: data.about,
      shopImageUrl: data.shop_image_url,
      shopInteriorVideoUrl: data.shop_interior_video_url,
      locationImageUrl: data.location_image_url,
      locationMapLink: data.location_map_link,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      address: data.address || null,
      street: data.street || null,
      district: data.district || null,
      state: data.state || null,
      country: data.country || null,
      password: data.password,
      barberMembers: typeof data.barber_members === 'string' ? JSON.parse(data.barber_members) : data.barber_members || [],
      services: typeof data.services === 'string' ? JSON.parse(data.services) : data.services || [],
      isOpen: data.is_open,
      tokenBookingPaused: data.token_booking_paused,
      openingTime: data.opening_time || '09:00',
      closingTime: data.closing_time || '18:00',
      category: data.category || 'salon',
      createdAt: new Date(data.created_at),
      lastPingTime: data.last_ping_time ? new Date(data.last_ping_time) : null,
      displayStatus: data.display_status || 'offline',
      isPinned: data.is_pinned || false,
      pinOrder: data.pin_order || 999,
      isWebsiteBuilderEnabled: data.is_website_builder_enabled !== false,
      isTokenBookingEnabled: data.token_booking_paused !== true,
      upiId: data.upi_id,
      advancePaymentMode: data.advance_payment_mode || 'none',
    };
  } catch (error) {
    console.error('Error in addShopToSupabase:', JSON.stringify(error, null, 2));
    return null;
  }
};

export const updateShopInSupabase = async (
  id: string,
  updates: Partial<Omit<Shop, 'id' | 'createdAt'>>
): Promise<Shop | null> => {
  try {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.ownerName !== undefined) updateData.owner_name = updates.ownerName;
    if (updates.ownerEmail !== undefined) updateData.owner_email = updates.ownerEmail;
    if (updates.ownerPhone !== undefined) updateData.owner_phone = updates.ownerPhone;
    if (updates.about !== undefined) updateData.about = updates.about;
    if (updates.shopImageUrl !== undefined) updateData.shop_image_url = updates.shopImageUrl;
    if (updates.shopInteriorVideoUrl !== undefined) updateData.shop_interior_video_url = updates.shopInteriorVideoUrl;
    if (updates.locationImageUrl !== undefined) updateData.location_image_url = updates.locationImageUrl;
    if (updates.locationMapLink !== undefined) updateData.location_map_link = updates.locationMapLink;
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude;
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.village !== undefined) updateData.village = updates.village;
    if (updates.district !== undefined) updateData.district = updates.district;
    if (updates.state !== undefined) updateData.state = updates.state;
    if (updates.country !== undefined) updateData.country = updates.country;
    if (updates.password !== undefined) updateData.password = updates.password;
    if (updates.barberMembers !== undefined) updateData.barber_members = JSON.stringify(updates.barberMembers);
    if (updates.services !== undefined) updateData.services = JSON.stringify(updates.services);
    if (updates.isOpen !== undefined) updateData.is_open = updates.isOpen;
    if (updates.tokenBookingPaused !== undefined) updateData.token_booking_paused = updates.tokenBookingPaused;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.openingTime !== undefined) updateData.opening_time = updates.openingTime;
    if (updates.closingTime !== undefined) updateData.closing_time = updates.closingTime;
    if (updates.lastPingTime !== undefined) updateData.last_ping_time = updates.lastPingTime;
    if (updates.displayStatus !== undefined) updateData.display_status = updates.displayStatus;
    if (updates.isPinned !== undefined) updateData.is_pinned = updates.isPinned;
    if (updates.pinOrder !== undefined) updateData.pin_order = updates.pinOrder;
    if (updates.isWebsiteBuilderEnabled !== undefined) updateData.is_website_builder_enabled = updates.isWebsiteBuilderEnabled;
    if (updates.isTokenBookingEnabled !== undefined) updateData.token_booking_paused = !updates.isTokenBookingEnabled;
    if (updates.upiId !== undefined) updateData.upi_id = updates.upiId;
    if (updates.advancePaymentMode !== undefined) updateData.advance_payment_mode = updates.advancePaymentMode;

    const { data, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating shop in Supabase:', JSON.stringify(error, null, 2));
      return null;
    }

    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      console.error('No shop found with id:', id);
      return null;
    }

    const shop = data[0];
    return {
      id: shop.id,
      name: shop.name,
      location: shop.location,
      ownerName: shop.owner_name,
      ownerEmail: shop.owner_email,
      ownerPhone: shop.owner_phone,
      about: shop.about,
      shopImageUrl: shop.shop_image_url,
      shopInteriorVideoUrl: shop.shop_interior_video_url,
      locationImageUrl: shop.location_image_url,
      locationMapLink: shop.location_map_link,
      latitude: shop.latitude || null,
      longitude: shop.longitude || null,
      address: shop.address || null,
      street: shop.street || null,
      district: shop.district || null,
      state: shop.state || null,
      country: shop.country || null,
      password: shop.password,
      barberMembers: typeof shop.barber_members === 'string' ? JSON.parse(shop.barber_members) : shop.barber_members || [],
      services: typeof shop.services === 'string' ? JSON.parse(shop.services) : shop.services || [],
      isOpen: shop.is_open,
      tokenBookingPaused: shop.token_booking_paused,
      openingTime: shop.opening_time || '09:00',
      closingTime: shop.closing_time || '18:00',
      category: shop.category || 'salon',
      createdAt: new Date(shop.created_at),
      lastPingTime: shop.last_ping_time ? new Date(shop.last_ping_time) : null,
      displayStatus: shop.display_status || 'offline',
      isPinned: shop.is_pinned || false,
      pinOrder: shop.pin_order || 999,
      isWebsiteBuilderEnabled: shop.is_website_builder_enabled !== false,
      isTokenBookingEnabled: shop.token_booking_paused !== true,
      upiId: shop.upi_id || null,
      advancePaymentMode: shop.advance_payment_mode || 'none',
    };
  } catch (error) {
    console.error('Error in updateShopInSupabase:', JSON.stringify(error, null, 2));
    return null;
  }
};

export const deleteShopFromSupabase = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('shops').delete().eq('id', id);

    if (error) {
      console.error('Error deleting shop from Supabase:', JSON.stringify(error, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteShopFromSupabase:', error);
    return false;
  }
};

export const seedDefaultShops = async (): Promise<void> => {
  // Skip seeding if Supabase is not configured
  if (!isSupabaseConfigured) {
    console.log('ℹ️ Supabase not configured, skipping shop seeding');
    return;
  }

  // Skip seeding if no internet connection
  if (!navigator.onLine) {
    console.log('📡 No internet connection, skipping shop seeding');
    return;
  }

  try {
    // Check if shops table exists and has data
    let hasExistingShops = false;
    try {
      const { data, error: checkError } = await supabase
        .from('shops')
        .select('id', { count: 'exact' })
        .limit(1);

      if (!checkError && data && data.length > 0) {
        hasExistingShops = true;
      }
    } catch (e) {
      console.warn('⚠️ Could not check existing shops:', e);
    }

    // If shops already exist, don't seed
    if (hasExistingShops) {
      console.log('Shops already exist, skipping seed');
      return;
    }

    // Add default shops
    const defaultShops = [
      {
        id: '1',
        name: 'Classic Cuts Barber',
        location: '123 Main Street, Downtown',
        owner_name: 'John Smith',
        owner_email: 'john.smith@example.com',
        owner_phone: '+1-555-0101',
        about: 'A classic barbershop offering traditional cuts and grooming services.',
        shop_image_url: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&h=300&fit=crop',
        location_image_url: 'https://images.unsplash.com/photo-1524136414933-a57106cb4df1?w=400&h=300&fit=crop',
        location_map_link: 'https://maps.google.com',
        password: '523452',
        barber_members: JSON.stringify([
          {
            id: '1-1',
            name: 'John Smith',
            experience: '15 years',
            imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
          },
        ]),
        services: JSON.stringify([
          { id: '1-s1', name: 'Haircut', price: '₹25' },
          { id: '1-s2', name: 'Beard Trim', price: '₹15' },
        ]),
        is_open: true,
        token_booking_paused: false,
        category: 'salon',
      },
      {
        id: '2',
        name: 'Elite Barbershop',
        location: '456 Oak Avenue, Midtown',
        owner_name: 'Maria Garcia',
        owner_email: 'maria.garcia@example.com',
        owner_phone: '+1-555-0102',
        about: 'Premium barbershop with expert stylists and modern techniques.',
        shop_image_url: 'https://images.unsplash.com/photo-1585747860715-cd4628902d4a?w=400&h=300&fit=crop',
        location_image_url: 'https://images.unsplash.com/photo-1554522149-5fb42f1a6cbe?w=400&h=300&fit=crop',
        location_map_link: 'https://maps.google.com',
        password: '523452',
        barber_members: JSON.stringify([
          {
            id: '2-1',
            name: 'Maria Garcia',
            experience: '12 years',
            imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
          },
        ]),
        services: JSON.stringify([
          { id: '2-s1', name: 'Premium Haircut', price: '₹35' },
          { id: '2-s2', name: 'Beard Design', price: '₹20' },
        ]),
        is_open: true,
        token_booking_paused: false,
        category: 'salon',
      },
    ];

    const { error: insertError } = await supabase.from('shops').insert(defaultShops);

    if (insertError) {
      console.warn('⚠️ Error seeding default shops:', JSON.stringify(insertError, null, 2));
      return;
    }

    console.log('Default shops seeded successfully');
  } catch (error) {
    console.warn('⚠️ Warning in seedDefaultShops:', JSON.stringify(error, null, 2));
    // Don't throw - allow app to continue
  }
};
