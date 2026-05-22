import { supabase } from './supabase';

export interface PrintingSettings {
  shopId: string;
  isEnabled: boolean;
  priceBwSingle: number;
  priceBwDouble: number;
  isColorAvailable: boolean;
  priceColorSingle: number;
  priceColorDouble: number;
  paperTypes: string[];
}

export interface PrintingOrder {
  id?: string;
  orderId: string;
  documentUrls: string[]; // Changed from documentUrl to support multiple files
  paperType: string;
  isDoubleSided: boolean;
  isColor: boolean;
  pageCount?: number;
  customerNote?: string;
  createdAt?: string;
}

export const getPrintingSettings = async (shopId: string): Promise<PrintingSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_printing_settings')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      shopId: data.shop_id,
      isEnabled: data.is_enabled,
      priceBwSingle: data.price_bw_single,
      priceBwDouble: data.price_bw_double,
      isColorAvailable: data.is_color_available,
      priceColorSingle: data.price_color_single,
      priceColorDouble: data.price_color_double,
      paperTypes: data.paper_types || [],
    };
  } catch (error) {
    console.error('Error fetching printing settings:', error);
    return null;
  }
};

export const savePrintingSettings = async (settings: PrintingSettings): Promise<boolean> => {
  try {
    const dbData = {
      shop_id: settings.shopId,
      is_enabled: settings.isEnabled,
      price_bw_single: settings.priceBwSingle,
      price_bw_double: settings.priceBwDouble,
      is_color_available: settings.isColorAvailable,
      price_color_single: settings.priceColorSingle,
      price_color_double: settings.priceColorDouble,
      paper_types: settings.paperTypes,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('shop_printing_settings')
      .upsert(dbData, { onConflict: 'shop_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving printing settings:', error);
    return false;
  }
};

export const createPrintingOrder = async (order: PrintingOrder): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('printing_orders')
      .insert([{
        order_id: order.orderId,
        document_urls: order.documentUrls,
        paper_type: order.paperType,
        is_double_sided: order.isDoubleSided,
        is_color: order.isColor,
        page_count: order.pageCount,
        customer_note: order.customerNote,
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating printing order:', error);
    return false;
  }
};

export const getPrintingOrderForMainOrder = async (orderId: string): Promise<PrintingOrder | null> => {
  try {
    const { data, error } = await supabase
      .from('printing_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(); // Use maybeSingle to prevent 406 errors when no record exists

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      orderId: data.order_id,
      documentUrls: data.document_urls || [],
      paperType: data.paper_type,
      isDoubleSided: data.is_double_sided,
      isColor: data.is_color,
      pageCount: data.page_count,
      customerNote: data.customer_note,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error fetching printing order:', error);
    return null;
  }
};

// Batch fetch printing orders for multiple order IDs in ONE query (avoids N+1)
export const getBatchPrintingOrdersForOrders = async (orderIds: string[]): Promise<Record<string, PrintingOrder>> => {
  if (orderIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('printing_orders')
      .select('*')
      .in('order_id', orderIds);

    if (error) throw error;

    const map: Record<string, PrintingOrder> = {};
    (data || []).forEach(row => {
      map[row.order_id] = {
        id: row.id,
        orderId: row.order_id,
        documentUrls: row.document_urls || [],
        paperType: row.paper_type,
        isDoubleSided: row.is_double_sided,
        isColor: row.is_color,
        pageCount: row.page_count,
        customerNote: row.customer_note,
        createdAt: row.created_at,
      };
    });
    return map;
  } catch (error) {
    console.error('Error batch fetching printing orders:', error);
    return {};
  }
};
