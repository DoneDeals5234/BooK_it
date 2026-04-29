import { supabase } from '@/lib/supabase';

export interface ScheduledReminder {
  id?: string;
  user_id: string;
  booking_id: string;
  shop_id: string;
  shop_name: string;
  token_number: number;
  user_name: string;
  time_slot: string;
  booking_date: string;
  reminder_time: string;
  scheduled_for?: string;
  timezone_offset_hours?: number;
  sent?: boolean;
  sent_at?: string;
  created_at?: string;
}

/**
 * Save a reminder to Supabase for server-side processing
 * The reminder will be processed by the be-alert-reminders function
 */
export async function saveReminderToSupabase(
  userId: string,
  bookingId: string,
  reminder: {
    shopId: string;
    shopName: string;
    tokenNumber: number;
    userName: string;
    timeSlot: string;
    bookingDate: string;
    reminderTime: string;
    timezoneOffsetHours?: number;
  }
): Promise<ScheduledReminder | null> {
  try {
    console.log('🔔 saveReminderToSupabase called');
    console.log(`   userId: ${userId}`);
    console.log(`   bookingId: ${bookingId}`);
    console.log(`   reminderTime: ${reminder.reminderTime}`);

    if (!userId || !bookingId) {
      console.error('❌ Missing userId or bookingId for reminder');
      return null;
    }

    // Calculate the scheduled time in UTC
    const [year, month, day] = reminder.bookingDate.split('-').map(Number);
    const [hour, minute] = reminder.reminderTime.split(':').map(Number);

    const timezoneOffsetHours = reminder.timezoneOffsetHours || 0;

    // Create UTC date
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

    // Convert from user's local time to UTC
    const offsetMs = timezoneOffsetHours * 60 * 60 * 1000;
    const utcTimeMs = utcDate.getTime() - offsetMs;
    const scheduledFor = new Date(utcTimeMs);

    console.log(`📍 Saving reminder to alert_reminders table:`);
    console.log(`   User timezone: UTC${timezoneOffsetHours > 0 ? '+' : ''}${timezoneOffsetHours}`);
    console.log(`   Reminder time (user local): ${reminder.reminderTime}`);
    console.log(`   Scheduled for (UTC): ${scheduledFor.toISOString()}`);
    console.log(`   Shop: ${reminder.shopName} | Token: #${reminder.tokenNumber}`);

    const insertData = {
      user_id: userId,
      booking_id: bookingId,
      shop_id: reminder.shopId,
      shop_name: reminder.shopName,
      token_number: reminder.tokenNumber,
      user_name: reminder.userName,
      time_slot: reminder.timeSlot,
      booking_date: reminder.bookingDate,
      reminder_time: reminder.reminderTime,
      scheduled_for: scheduledFor.toISOString(),
      timezone_offset_hours: timezoneOffsetHours,
      sent: false,
    };

    console.log('📤 Inserting into alert_reminders:', insertData);

    const { data, error } = await supabase
      .from('alert_reminders')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving reminder to alert_reminders:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error details:', error);
      return null;
    }

    if (!data) {
      console.error('❌ No data returned from insert');
      return null;
    }

    console.log('✅ Reminder saved to alert_reminders successfully');
    console.log(`   Reminder ID: ${data.id}`);
    console.log(`   Scheduled for: ${data.scheduled_for}`);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'N/A';
    console.error('❌ Exception in saveReminderToSupabase:', {
      message: errorMessage,
      stack: errorStack,
    });
    return null;
  }
}

/**
 * Get all pending reminders for a user
 */
export async function getUserPendingReminders(userId: string): Promise<ScheduledReminder[]> {
  try {
    const { data, error } = await supabase
      .from('alert_reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('sent', false)
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error fetching pending reminders:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return data || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in getUserPendingReminders:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get a specific reminder
 */
export async function getReminder(reminderId: string): Promise<ScheduledReminder | null> {
  try {
    const { data, error } = await supabase
      .from('alert_reminders')
      .select('*')
      .eq('id', reminderId)
      .single();

    if (error) {
      console.error('Error fetching reminder:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in getReminder:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('alert_reminders')
      .delete()
      .eq('id', reminderId);

    if (error) {
      console.error('Error deleting reminder:', error);
      return false;
    }

    console.log(`✅ Reminder ${reminderId} deleted`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in deleteReminder:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Get statistics about reminders
 */
export async function getReminderStats() {
  try {
    const { data: allReminders, error: allError } = await supabase
      .from('alert_reminders')
      .select('*');

    const { data: pendingReminders, error: pendingError } = await supabase
      .from('alert_reminders')
      .select('*')
      .eq('sent', false)
      .lte('scheduled_for', new Date().toISOString());

    const { data: sentReminders, error: sentError } = await supabase
      .from('alert_reminders')
      .select('*')
      .eq('sent', true);

    if (allError || pendingError || sentError) {
      console.error('Error fetching reminder stats');
      return null;
    }

    return {
      total: allReminders?.length || 0,
      pending: pendingReminders?.length || 0,
      sent: sentReminders?.length || 0,
      dueNow: pendingReminders || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in getReminderStats:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
