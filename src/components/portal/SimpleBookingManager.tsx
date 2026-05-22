import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { Loader2, Bell, Clock, Check, X, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendNativeNotification } from '@/lib/native-notifications';

interface Booking {
  id: string;
  shop_id: string;
  service_name: string;
  service_price: string;
  time_slot: string;
  token_number: number;
  user_name: string;
  user_phone: string;
  booking_date: string;
  status: string;
  user_id: string;
  rejection_reason?: string;
}

interface SimpleBookingManagerProps {
  shopId: string;
}

export const SimpleBookingManager = ({ shopId }: SimpleBookingManagerProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingForReject, setSelectedBookingForReject] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadingBookingId, setLoadingBookingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBookings(data);
      }
      setLoading(false);
    };

    fetchBookings();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`shop-bookings-${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `shop_id=eq.${shopId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setBookings((prev) => [payload.new as Booking, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setBookings((prev) =>
              prev.map((b) => (b.id === payload.new.id ? (payload.new as Booking) : b))
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [shopId]);

  const handleStatusUpdate = async (bookingId: string, status: string, reason?: string) => {
    setLoadingBookingId(bookingId);
    try {
      const updateData: any = { status };
      if (reason) updateData.rejection_reason = reason;

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;
      
      // Update local state immediately
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updateData } : b))
      );

      toast.success(`Booking ${status}!`);

      // Find the booking to get user_id
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking && booking.user_id) {
        // Send notification to customer
        await sendNativeNotification([booking.user_id], {
          title: status === 'accepted' ? '✅ Booking Accepted' : '❌ Booking Rejected',
          body: status === 'accepted'
            ? `Your booking for ${booking.service_name} has been accepted!`
            : `Your booking for ${booking.service_name} was rejected. Reason: ${reason || 'Not specified'}`,
          data: { type: 'booking_status', bookingId, status }
        });
      }

      if (status === 'rejected') {
        setSelectedBookingForReject(null);
        setRejectionReason('');
      }
    } catch (error) {
      toast.error('Failed to update booking status');
    } finally {
      setLoadingBookingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No bookings found for this shop.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{booking.user_name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {booking.user_phone}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                    booking.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                    booking.status === 'accepted' ? 'bg-green-100 text-green-600' :
                    booking.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Service</p>
                    <p className="font-medium">{booking.service_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Price</p>
                    <p className="font-medium">₹{booking.service_price}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Date</p>
                    <p className="font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> {booking.booking_date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Time</p>
                    <p className="font-medium">{booking.time_slot}</p>
                  </div>
                </div>

                {booking.status === 'rejected' && booking.rejection_reason && (
                  <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg">
                    <strong>Rejection Reason:</strong> {booking.rejection_reason}
                  </div>
                )}
              </div>

              {booking.status === 'pending' && (
                <div className="flex sm:flex-col gap-2 justify-end sm:justify-center">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                    onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                    disabled={loadingBookingId === booking.id}
                  >
                    {loadingBookingId === booking.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none"
                    onClick={() => setSelectedBookingForReject(booking)}
                    disabled={loadingBookingId === booking.id}
                  >
                    {loadingBookingId === booking.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />} Reject
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Reject Reason Modal */}
      <Dialog open={!!selectedBookingForReject} onOpenChange={(open) => !open && setSelectedBookingForReject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Input
                id="rejection-reason"
                placeholder="e.g., Shop is busy, Slot unavailable"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBookingForReject(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  toast.error('Please enter a reason');
                  return;
                }
                if (selectedBookingForReject) {
                  handleStatusUpdate(selectedBookingForReject.id, 'rejected', rejectionReason);
                }
              }}
              disabled={loadingBookingId === selectedBookingForReject?.id}
            >
              {loadingBookingId === selectedBookingForReject?.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
