import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Clock, Bell, CheckCircle2, Loader } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/lib/supabase';
import { isTimeSlotBookedInSupabase, getNextTokenNumberFromSupabase } from '@/lib/supabase-bookings';
import { getAllTimeSlots, getCurrentISTDate } from '@/lib/bookings-storage';
import { sendNativeNotification } from '@/lib/native-notifications';
import { addBookingToHistory } from '@/lib/booking-history';
import { startForegroundAlarmService } from '@/lib/alarm-scheduler';
import type { Shop, Service } from '@/lib/shops-storage';

type BookingStep = 'service' | 'time-slot' | 'reminder' | 'confirmation' | 'success';

interface BookingModalNewProps {
  shop: Shop;
  onClose: () => void;
  onBookingCreated?: () => void;
  initialService?: Service;
}

export const BookingModalNew = ({
  shop,
  onClose,
  onBookingCreated,
  initialService,
}: BookingModalNewProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [step, setStep] = useState<BookingStep>(initialService ? 'time-slot' : 'service');
  const [selectedService, setSelectedService] = useState<Service | null>(initialService || null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<string>('30');
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentISTDate());
  const [loadingSlots, setLoadingSlots] = useState(false);

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

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const bookingDate = selectedDate;
      const allSlots = getAllTimeSlots();
      const available: string[] = [];

      for (const slot of allSlots) {
        const isBooked = await isTimeSlotBookedInSupabase(shop.id, slot, bookingDate);
        if (!isBooked) available.push(slot);
      }

      setAvailableTimeSlots(available);
      if (available.length === 0) toast.error('No available time slots for today');
    } catch (error) {
      toast.error('Failed to load available slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (step === 'time-slot') loadAvailableSlots();
  }, [step, selectedDate]);

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
      const bookingDate = selectedDate;
      const tokenNumber = await getNextTokenNumberFromSupabase(shop.id);

      const bookingData = {
        shop_id: shop.id,
        shop_name: shop.name,
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

      if (error) throw new Error(error.message || 'Failed to create booking.');

      const reminderTime = calculateReminderTime(selectedTimeSlot, parseInt(reminderMinutes));
      const triggerTimeMs = calculateTriggerTimeMs(selectedTimeSlot, parseInt(reminderMinutes));

      await supabase
        .from('bookings')
        .update({
          reminder_time: reminderTime,
          reminder_minutes_before: parseInt(reminderMinutes),
        })
        .eq('id', data.id);

      addBookingToHistory(user.uid, {
        bookingId: data.id,
        shopId: shop.id,
        shopName: shop.name,
        tokenNumber: tokenNumber,
        timeSlot: selectedTimeSlot,
        bookingDate: bookingDate,
        status: 'pending',
      });

      startDeviceForegroundService(data.id, tokenNumber, triggerTimeMs);
      sendBookingNotifications(data, selectedService.name);
      setupDeviceReminder(data.id, reminderTime, selectedService.name);

      setStep('success');
      setTimeout(() => {
        toast.success('Booking confirmed!');
        onBookingCreated?.();
        onClose();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const calculateReminderTime = (timeSlot: string, minutesBefore: number): string => {
    const today = new Date();
    const [time, period] = timeSlot.includes(' ') ? timeSlot.split(' ') : [timeSlot];
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const slotTime = new Date(today);
    slotTime.setHours(hours, minutes, 0);
    return new Date(slotTime.getTime() - minutesBefore * 60000).toISOString();
  };

  const setupDeviceReminder = (bookingId: string, reminderTime: string, serviceName: string) => {
    const delayMs = new Date(reminderTime).getTime() - Date.now();
    if (delayMs > 0) {
      const reminders = JSON.parse(localStorage.getItem('pending_reminders') || '[]');
      reminders.push({ bookingId, reminderTime, serviceName, shopId: shop.id, shopName: shop.name });
      localStorage.setItem('pending_reminders', JSON.stringify(reminders));
      setTimeout(() => triggerReminderAlert(bookingId, serviceName), delayMs);
    }
  };

  const triggerReminderAlert = async (bookingId: string, serviceName: string) => {
    const confirmed = window.confirm(`🔔 Reminder!\n\nAppointment for ${serviceName} at ${shop.name} is coming up!\n\nAre you coming?`);
    if (confirmed) await notifyShopOwner(bookingId, serviceName);
    else await cancelBooking(bookingId);
  };

  const notifyShopOwner = async (bookingId: string, serviceName: string) => {
    try {
      await supabase.from('bookings').update({ customer_confirmed: true, reminder_triggered_at: new Date().toISOString() }).eq('id', bookingId);
      
      const { data: owners } = await supabase.from('native_shop_owners').select('user_id').eq('shop_id', shop.id).limit(1);
      const ownerId = owners?.[0]?.user_id;
      
      if (ownerId) {
        await sendNativeNotification([ownerId], {
          title: '📞 Customer Confirmation',
          body: `${profile?.name || 'A customer'} confirmed they are coming for ${serviceName}!`,
          data: { type: 'confirmation', bookingId }
        });
      }
      toast.success('Confirmation sent!');
    } catch (error) {}
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      await supabase.from('bookings').update({ customer_confirmed: false, status: 'cancelled', reminder_triggered_at: new Date().toISOString() }).eq('id', bookingId);
    } catch (error) {}
  };

  const calculateTriggerTimeMs = (timeSlot: string, minutesBefore: number): number => {
    const today = new Date();
    const [time, period] = timeSlot.includes(' ') ? timeSlot.split(' ') : [timeSlot];
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const slotTime = new Date(today);
    slotTime.setHours(hours, minutes, 0, 0);
    const triggerTime = new Date(slotTime.getTime() - minutesBefore * 60000);
    if (triggerTime.getTime() < Date.now()) triggerTime.setDate(triggerTime.getDate() + 1);
    return triggerTime.getTime();
  };

  const startDeviceForegroundService = async (bookingId: string, tokenNumber: number, triggerTimeMs: number) => {
    try {
      await startForegroundAlarmService({ bookingId, tokenNumber, shopName: shop.name, timeSlot: selectedTimeSlot, triggerTimeMs });
    } catch (error) {}
  };

  const sendBookingNotifications = async (bookingData: any, serviceName: string) => {
    try {
      // Notify customer
      await sendNativeNotification([user?.uid || ''], {
        title: '✅ Booking Successful',
        body: `Your booking for ${serviceName} at ${shop.name} on ${selectedDate} at ${selectedTimeSlot} is successful.`
      });

      // Notify shop owner
      const { data: owners } = await supabase.from('native_shop_owners').select('user_id').eq('shop_id', shop.id).limit(1);
      if (owners?.[0]?.user_id) {
        await sendNativeNotification([owners[0].user_id], {
          title: '📌 New Booking',
          body: `New booking from ${profile?.name || 'Customer'} for ${serviceName} on ${selectedDate} at ${selectedTimeSlot}`
        });
      }
    } catch (error) {}
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Book Appointment</DialogTitle>
            <div className="flex gap-1">
              {(['service', 'time-slot', 'reminder', 'confirmation'] as const).map((s) => (
                <div key={s} className={`h-2 w-8 rounded-full transition-colors ${['service', 'time-slot', 'reminder', 'confirmation'].indexOf(s) < ['service', 'time-slot', 'reminder', 'confirmation'].indexOf(step) ? 'bg-green-500' : s === step ? 'bg-blue-500' : 'bg-gray-300'}`} />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {step === 'service' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Select a Service</Label>
              <div className="grid gap-3">
                {shop.services.map((service) => (
                  <Card key={service.id} className={`cursor-pointer transition-all ${selectedService?.id === service.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-blue-300'}`} onClick={() => handleServiceSelect(service)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-sm text-muted-foreground">Price: {service.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {step === 'time-slot' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5" />Select Date & Time Slot</Label>
              
              {/* Date Picker */}
              <div className="space-y-2">
                <Label htmlFor="booking-date" className="text-sm font-medium">Date</Label>
                <Input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getCurrentISTDate()}
                  className="w-full"
                />
              </div>

              {loadingSlots ? <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-blue-500" /></div> : 
               availableTimeSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableTimeSlots.map((slot) => (
                    <Button key={slot} variant={selectedTimeSlot === slot ? 'default' : 'outline'} onClick={() => handleTimeSlotSelect(slot)} className="h-12">{slot}</Button>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">No available slots for {selectedDate === getCurrentISTDate() ? 'today' : selectedDate}.</p>}
            </div>
          )}

          {step === 'reminder' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" />Set Reminder</Label>
              <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Confirm Your Booking</Label>
              <Card className="p-4 space-y-3 bg-gray-50">
                <div className="flex justify-between"><span>Customer:</span><span className="font-semibold">{profile?.name || 'Customer'}</span></div>
                <div className="flex justify-between"><span>Service:</span><span className="font-semibold">{selectedService?.name}</span></div>
                <div className="flex justify-between"><span>Date:</span><span className="font-semibold">{selectedDate}</span></div>
                <div className="flex justify-between"><span>Time:</span><span className="font-semibold">{selectedTimeSlot}</span></div>
                <div className="flex justify-between"><span>Reminder:</span><span className="font-semibold">{reminderMinutes} min before</span></div>
              </Card>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold">Booking Confirmed!</h3>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {step !== 'success' && (
            <Button variant="outline" onClick={() => {
              if (step === 'service') onClose();
              else if (step === 'time-slot') setStep('service');
              else if (step === 'reminder') setStep('time-slot');
              else if (step === 'confirmation') setStep('reminder');
            }}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          )}
          {step === 'confirmation' ? (
            <Button onClick={handleConfirmBooking} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
              {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm Booking
            </Button>
          ) : step !== 'success' && (
            <Button onClick={() => {
              if (step === 'service' && selectedService) setStep('time-slot');
              else if (step === 'time-slot' && selectedTimeSlot) setStep('reminder');
              else if (step === 'reminder') setStep('confirmation');
            }} disabled={step === 'service' && !selectedService || step === 'time-slot' && !selectedTimeSlot} className="flex-1">Continue</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
