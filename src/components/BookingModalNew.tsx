import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Clock, Bell, CheckCircle2, Loader } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/lib/supabase';
import { isTimeSlotBookedInSupabase, getNextTokenNumberFromSupabase } from '@/lib/supabase-bookings';
import { getAllTimeSlots, getCurrentISTDate } from '@/lib/bookings-storage';
import { sendNotificationToPlayerIds } from '@/lib/onesignal-messaging';
import { getPlayerIdFromNativeDevices, getPlayerIdByEmail } from '@/lib/supabase-native-devices';
import { addBookingToHistory } from '@/lib/booking-history';
import { startForegroundAlarmService } from '@/lib/alarm-scheduler';
import type { Shop, Service } from '@/lib/shops-storage';

type BookingStep = 'service' | 'time-slot' | 'reminder' | 'confirmation' | 'success';

interface BookingModalNewProps {
  shop: Shop;
  onClose: () => void;
  onBookingCreated?: () => void;
}

export const BookingModalNew = ({
  shop,
  onClose,
  onBookingCreated,
}: BookingModalNewProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // Form state
  const [step, setStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<string>('30');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Check if shop is open/bookable
  if (!shop.isOpen || shop.tokenBookingPaused || shop.isTokenBookingEnabled === false) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Not Available</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center space-y-3">
            <p className="text-lg font-semibold text-red-600">
              {!shop.isOpen ? '🔴 Shop is Closed' :
               shop.isTokenBookingEnabled === false ? '🚫 Booking Facility Disabled' :
               '⏸️ Bookings Paused'}
            </p>
            <p className="text-muted-foreground text-sm">
              {!shop.isOpen
                ? 'Booking is not available when the shop is closed.'
                : shop.isTokenBookingEnabled === false
                ? 'The shop owner has disabled the booking facility.'
                : 'The shop owner has temporarily paused bookings.'}
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Load available time slots
  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const bookingDate = getCurrentISTDate();
      const allSlots = getAllTimeSlots();
      const available: string[] = [];

      for (const slot of allSlots) {
        const isBooked = await isTimeSlotBookedInSupabase(shop.id, slot, bookingDate);
        if (!isBooked) {
          available.push(slot);
        }
      }

      setAvailableTimeSlots(available);
      if (available.length === 0) {
        toast.error('No available time slots for today');
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      toast.error('Failed to load available slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Load slots when moving to time-slot step
  useEffect(() => {
    if (step === 'time-slot') {
      loadAvailableSlots();
    }
  }, [step]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep('time-slot');
  };

  const handleTimeSlotSelect = (slot: string) => {
    setSelectedTimeSlot(slot);
    setStep('reminder');
  };

  const handleReminderSet = () => {
    if (!selectedTimeSlot || !reminderMinutes) {
      toast.error('Please select a time slot and reminder time');
      return;
    }
    setStep('confirmation');
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedService || !selectedTimeSlot) {
      toast.error('Missing booking information');
      return;
    }

    setLoading(true);
    try {
      const bookingDate = getCurrentISTDate();

      // Get next token number for this shop
      const tokenNumber = await getNextTokenNumberFromSupabase(shop.id);

      // Create booking in Supabase (without reminder fields to avoid schema cache issues)
      const bookingData = {
        shop_id: shop.id,
        service_name: selectedService.name,
        service_price: selectedService.price,
        time_slot: selectedTimeSlot,
        token_number: tokenNumber,
        user_name: profile?.name || 'Customer',
        user_phone: profile?.phone || '',
        booking_date: bookingDate,
        user_id: user.uid,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();

      if (error) {
        const errorMessage = error.message || (error instanceof Error ? error.toString() : JSON.stringify(error));
        console.error('Booking error:', errorMessage);
        throw new Error(errorMessage || 'Failed to create booking. Make sure database migrations are applied.');
      }

      console.log('✅ Booking created:', data);

      // Calculate reminder time and trigger time for foreground service
      const reminderTime = calculateReminderTime(selectedTimeSlot, parseInt(reminderMinutes));
      const triggerTimeMs = calculateTriggerTimeMs(selectedTimeSlot, parseInt(reminderMinutes));

      // Update booking with reminder details
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          reminder_time: reminderTime,
          reminder_minutes_before: parseInt(reminderMinutes),
        })
        .eq('id', data.id);

      if (updateError) {
        console.warn('Warning: Could not update reminder details:', updateError);
      }

      // Add booking to local history for profile display
      addBookingToHistory(user.uid, {
        bookingId: data.id,
        shopId: shop.id,
        shopName: shop.name,
        tokenNumber: tokenNumber,
        timeSlot: selectedTimeSlot,
        bookingDate: bookingDate,
        status: 'pending',
      });

      // Start foreground service on device
      startDeviceForegroundService(data.id, tokenNumber, triggerTimeMs);

      // Send notifications to customer and shop owner (non-blocking)
      sendBookingNotifications(data, selectedService.name);

      // Set local device reminder using browser API
      setupDeviceReminder(data.id, data.reminder_time, data.service_name);

      setStep('success');
      setTimeout(() => {
        toast.success('Booking confirmed! You\'ll be reminded before your appointment.');
        onBookingCreated?.();
        onClose();
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating booking:', errorMessage);
      toast.error(error instanceof Error ? error.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const calculateReminderTime = (
    timeSlot: string,
    minutesBefore: number
  ): string => {
    // timeSlot format: "10:00 AM" or "10:00"
    const today = new Date();
    const [time, period] = timeSlot.includes(' ') ? timeSlot.split(' ') : [timeSlot];
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const slotTime = new Date(today);
    slotTime.setHours(hours, minutes, 0);

    const reminderTime = new Date(slotTime.getTime() - minutesBefore * 60000);
    return reminderTime.toISOString();
  };

  const setupDeviceReminder = (bookingId: string, reminderTime: string, serviceName: string) => {
    const reminderDate = new Date(reminderTime);
    const now = new Date();
    const delayMs = reminderDate.getTime() - now.getTime();

    if (delayMs > 0) {
      // Store reminder in localStorage for persistence
      const reminders = JSON.parse(localStorage.getItem('pending_reminders') || '[]');
      reminders.push({
        bookingId,
        reminderTime,
        serviceName,
        shopId: shop.id,
        shopName: shop.name,
      });
      localStorage.setItem('pending_reminders', JSON.stringify(reminders));

      // Schedule reminder using setTimeout (works in browser while app is open)
      setTimeout(() => {
        triggerReminderAlert(bookingId, serviceName);
      }, delayMs);

      // Request notification permission if not already granted
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Also try to use Notification API if available
      if ('Notification' in window && Notification.permission === 'granted') {
        // Browser notification as backup
        setTimeout(() => {
          new Notification(`Reminder: ${serviceName}`, {
            body: `Your appointment at ${shop.name} is coming up!`,
            icon: shop.shopImageUrl || '',
            tag: `booking-${bookingId}`,
            requireInteraction: true,
          });
        }, delayMs);
      }
    }

    console.log(`📱 Device reminder set for ${reminderTime}`);
  };

  const triggerReminderAlert = async (bookingId: string, serviceName: string) => {
    // Show full-screen alert dialog with Yes/No
    const confirmed = window.confirm(
      `🔔 Reminder!\n\nYour appointment for ${serviceName} at ${shop.name} is coming up!\n\nAre you coming?`
    );

    if (confirmed) {
      // Customer confirmed - send notification to shop owner
      await notifyShopOwner(bookingId, serviceName);
    } else {
      // Customer said no - cancel booking
      await cancelBooking(bookingId);
    }
  };

  const notifyShopOwner = async (bookingId: string, serviceName: string) => {
    try {
      // Update booking to mark as confirmed
      const { error } = await supabase
        .from('bookings')
        .update({
          customer_confirmed: true,
          reminder_triggered_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) {
        console.error('Error updating booking:', error);
        toast.error('Failed to save confirmation');
        return;
      }

      // Try to get shop owner's player ID and send notification
      try {
        const playerId = await getPlayerIdFromNativeDevices(shop.ownerEmail);
        if (playerId) {
          await sendNotificationToPlayerIds(
            [playerId],
            {
              headings: { en: '📞 Customer Confirmation' },
              contents: {
                en: `${profile?.name || 'A customer'} confirmed they are coming for ${serviceName}!`,
              },
            }
          );
        }
      } catch (notifError) {
        console.warn('Could not send notification to owner:', notifError);
        // Don't fail if notification fails
      }

      toast.success('Confirmation sent to shop owner!');
    } catch (error) {
      console.error('Error notifying shop owner:', error);
      toast.error('Failed to send confirmation');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          customer_confirmed: false,
          status: 'cancelled',
          reminder_triggered_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;
      console.log('✅ Booking cancelled silently');
    } catch (error) {
      console.error('Error cancelling booking:', error);
    }
  };

  const calculateTriggerTimeMs = (
    timeSlot: string,
    minutesBefore: number
  ): number => {
    // Calculate the time in milliseconds when reminder should trigger
    const today = new Date();
    const [time, period] = timeSlot.includes(' ') ? timeSlot.split(' ') : [timeSlot];
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const slotTime = new Date(today);
    slotTime.setHours(hours, minutes, 0, 0);

    const triggerTime = new Date(slotTime.getTime() - minutesBefore * 60000);
    const now = new Date();

    // If trigger time is in the past, adjust to next day
    if (triggerTime.getTime() < now.getTime()) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    console.log(
      `⏰ Reminder trigger time calculated:`,
      `Slot: ${slotTime.toLocaleString()}`,
      `Trigger: ${triggerTime.toLocaleString()}`,
      `Milliseconds: ${triggerTime.getTime()}`
    );

    return triggerTime.getTime();
  };

  const startDeviceForegroundService = async (
    bookingId: string,
    tokenNumber: number,
    triggerTimeMs: number
  ) => {
    try {
      console.log('📱 Starting foreground service for booking reminder...');
      const result = await startForegroundAlarmService({
        bookingId,
        tokenNumber,
        shopName: shop.name,
        timeSlot: selectedTimeSlot,
        triggerTimeMs,
      });

      if (result.success) {
        console.log('✅ Foreground service started successfully');
        console.log(`   Will ring at: ${new Date(triggerTimeMs).toLocaleString()}`);
        toast.success(
          `🔔 Reminder set!\nWill ring ${reminderMinutes} minutes before your appointment`,
          { duration: 3000 }
        );
      } else {
        console.warn('⚠️ Failed to start foreground service:', result.message);
        // Don't fail the booking if foreground service fails - it's a nice-to-have
        console.warn('Booking continues despite foreground service failure');
      }
    } catch (error) {
      console.error('❌ Error starting foreground service:', error);
      // Don't fail the booking
    }
  };

  const sendBookingNotifications = async (
    bookingData: any,
    serviceName: string
  ) => {
    try {
      // Send notification to customer
      try {
        const customerPlayerId = await getPlayerIdFromNativeDevices(user.uid);
        if (customerPlayerId) {
          await sendNotificationToPlayerIds(
            [customerPlayerId],
            {
              headings: { en: '✅ Booking Confirmed' },
              contents: {
                en: `Your booking for ${serviceName} at ${shop.name} is confirmed! Your appointment is at ${selectedTimeSlot}.`,
              },
            }
          );
          console.log('✅ Notification sent to customer');
        }
      } catch (customerError) {
        console.warn('Could not send notification to customer:', customerError);
      }

      // Send notification to shop owner
      try {
        const ownerPlayerId = await getPlayerIdByEmail(shop.ownerEmail);
        if (ownerPlayerId) {
          await sendNotificationToPlayerIds(
            [ownerPlayerId],
            {
              headings: { en: '📌 New Booking' },
              contents: {
                en: `New booking from ${profile?.name || 'Customer'} for ${serviceName} at ${selectedTimeSlot}`,
              },
            }
          );
          console.log('✅ Notification sent to shop owner');
        }
      } catch (ownerError) {
        console.warn('Could not send notification to shop owner:', ownerError);
      }
    } catch (error) {
      console.error('Error sending booking notifications:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Book Appointment</DialogTitle>
            <div className="flex gap-1">
              {(['service', 'time-slot', 'reminder', 'confirmation'] as const).map((s) => (
                <div
                  key={s}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    ['service', 'time-slot', 'reminder', 'confirmation'].indexOf(s) <
                    ['service', 'time-slot', 'reminder', 'confirmation'].indexOf(step)
                      ? 'bg-green-500'
                      : s === step
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Step {['service', 'time-slot', 'reminder', 'confirmation'].indexOf(step) + 1} of 4
          </p>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Step 1: Service Selection */}
          {step === 'service' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Select a Service</Label>
              <div className="grid gap-3">
                {shop.services.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all ${
                      selectedService?.id === service.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:border-blue-300'
                    }`}
                    onClick={() => handleServiceSelect(service)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-sm text-muted-foreground">Price: {service.price}</p>
                      </div>
                      <div
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                          selectedService?.id === service.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedService?.id === service.id && (
                          <div className="h-2 w-2 bg-white rounded-full" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Time Slot Selection */}
          {step === 'time-slot' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Select Time Slot
              </Label>
              {loadingSlots ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : availableTimeSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableTimeSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedTimeSlot === slot ? 'default' : 'outline'}
                      onClick={() => handleTimeSlotSelect(slot)}
                      className="h-12"
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No available slots for today. Please try again tomorrow.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Reminder Setup */}
          {step === 'reminder' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Set Reminder
              </Label>
              <p className="text-sm text-muted-foreground">
                Get reminded before your appointment at {selectedTimeSlot}
              </p>
              <div className="space-y-3">
                <Label htmlFor="reminder-select">Remind me before:</Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger id="reminder-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes before</SelectItem>
                    <SelectItem value="30">30 minutes before</SelectItem>
                    <SelectItem value="45">45 minutes before</SelectItem>
                    <SelectItem value="60">1 hour before</SelectItem>
                    <SelectItem value="120">2 hours before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card className="bg-blue-50 border-blue-200 p-4">
                <p className="text-sm text-blue-900">
                  📱 You'll receive a reminder at the set time. When the reminder appears, you can confirm
                  or cancel your appointment.
                </p>
              </Card>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirmation' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Confirm Your Booking</Label>
              <Card className="p-4 space-y-3 bg-gray-50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-semibold">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-semibold">{selectedTimeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-semibold text-green-600">{selectedService?.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reminder:</span>
                  <span className="font-semibold">{reminderMinutes} min before</span>
                </div>
              </Card>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-bold">Booking Confirmed!</h3>
                <p className="text-muted-foreground mt-1">
                  You'll be reminded {reminderMinutes} minutes before your appointment.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3">
          {step !== 'success' && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'service') {
                  onClose();
                } else if (step === 'time-slot') {
                  setStep('service');
                } else if (step === 'reminder') {
                  setStep('time-slot');
                } else if (step === 'confirmation') {
                  setStep('reminder');
                }
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {step === 'service' && (
            <Button disabled className="flex-1">
              Continue (Select a service)
            </Button>
          )}

          {step === 'time-slot' && (
            <Button
              onClick={() => handleTimeSlotSelect(selectedTimeSlot)}
              disabled={!selectedTimeSlot}
              className="flex-1"
            >
              Continue
            </Button>
          )}

          {step === 'reminder' && (
            <Button onClick={handleReminderSet} className="flex-1">
              Continue
            </Button>
          )}

          {step === 'confirmation' && (
            <Button
              onClick={handleConfirmBooking}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Booking
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
