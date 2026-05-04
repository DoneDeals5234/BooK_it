import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Clock, IndianRupee, User, Phone, AlertCircle } from 'lucide-react';
import { subscribeToBookingRequests } from '@/lib/booking-negotiation';
import { OwnerBookingAlert } from './OwnerBookingAlert';
import { OwnerCounterOfferModal } from './OwnerCounterOfferModal';
import type { BookingRequest } from '@/contexts/BookingNegotiationContext';
import type { TimeSlotSetting } from '@/lib/shops-storage';

interface IncomingBookingRequestsProps {
  shopId: string;
  timeSlotSettings: TimeSlotSetting[] | undefined;
}

export const IncomingBookingRequests = ({
  shopId,
  timeSlotSettings,
}: IncomingBookingRequestsProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [counterOfferOpen, setCounterOfferOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [loading, setLoading] = useState(false);

  // Subscribe to incoming booking requests
  useEffect(() => {
    const unsubscribe = subscribeToBookingRequests(shopId, (bookingRequests) => {
      // Filter for pending requests
      const pendingRequests = bookingRequests.filter(
        (r) =>
          r.status === 'pending_owner_response' ||
          r.status === 'pending_customer_response' ||
          r.status === 'counter_offered'
      );
      setRequests(pendingRequests);

      // Auto-open alert for new pending request
      if (pendingRequests.length > 0 && !selectedRequest) {
        const newest = pendingRequests[0];
        if (newest.status === 'pending_owner_response') {
          setSelectedRequest(newest);
          setAlertOpen(true);
          setSecondsRemaining(60);
        }
      }
    });

    return () => unsubscribe();
  }, [shopId, selectedRequest]);

  // Countdown timer
  useEffect(() => {
    if (alertOpen && secondsRemaining > 0) {
      const timer = setTimeout(() => {
        setSecondsRemaining(secondsRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (alertOpen && secondsRemaining === 0) {
      setAlertOpen(false);
    }
  }, [secondsRemaining, alertOpen]);

  const handleConfirm = async () => {
    if (!selectedRequest) return;

    setLoading(true);
    try {
      // Confirm the booking request
      // Update status to 'owner_confirmed'
      // Create actual booking record
      // Send notification to customer
      console.log('✅ Booking confirmed:', selectedRequest.id);
      setAlertOpen(false);
      setSelectedRequest(null);
      // TODO: Implement booking confirmation logic
    } catch (error) {
      console.error('Error confirming booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setCounterOfferOpen(true);
  };

  const handleSubmitCounterOffer = async (offeredTimes: string[]) => {
    if (!selectedRequest) return;

    setLoading(true);
    try {
      // Create counter-offer
      // Update booking request status to 'counter_offered'
      // Send notification to customer with offered times
      console.log('📤 Counter-offer sent:', offeredTimes);
      setCounterOfferOpen(false);
      setAlertOpen(false);
      setSelectedRequest(null);
      // TODO: Implement counter-offer logic
    } catch (error) {
      console.error('Error sending counter-offer:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (slot: string) => {
    const [h, m] = slot.split(':');
    const hour12 = parseInt(h) % 12 || 12;
    const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  if (requests.length === 0) {
    return (
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Booking Requests</CardTitle>
          <CardDescription className="text-xs">New customer requests will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No pending requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Bell className="h-5 w-5 text-red-500" />
            Booking Requests ({requests.length})
          </CardTitle>
          <CardDescription className="text-xs">Respond to customer requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white leading-none">{request.customerName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Customer</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                    request.status === 'pending_owner_response'
                      ? 'bg-red-50 text-red-500'
                      : 'bg-blue-50 text-blue-500'
                  }`}>
                    {request.status === 'pending_owner_response' ? 'Action Required' : 'Awaiting'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Service & Price */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{request.serviceName}</p>
                      <span className="text-xs font-black text-red-500">{request.servicePrice}</span>
                    </div>
                  </div>

                  {/* Preferred Times */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preferred Times</p>
                    <div className="flex flex-wrap gap-1">
                      {request.requestedTimeSlots.map((slot) => (
                        <span key={slot} className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700 shadow-sm">
                          {formatTime(slot)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`tel:${request.customerPhone}`} className="text-sm font-bold text-slate-600 hover:text-red-500">
                      {request.customerPhone}
                    </a>
                  </div>

                  {/* Action Buttons */}
                  {request.status === 'pending_owner_response' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setAlertOpen(true);
                        setSecondsRemaining(60);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold h-9 px-4 rounded-xl shadow-sm"
                    >
                      Respond
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Booking Alert Modal */}
      {selectedRequest && (
        <>
          <OwnerBookingAlert
            request={selectedRequest}
            secondsRemaining={secondsRemaining}
            onConfirm={handleConfirm}
            onReject={handleReject}
            open={alertOpen}
            onOpenChange={setAlertOpen}
          />

          {/* Counter-Offer Modal */}
          <OwnerCounterOfferModal
            open={counterOfferOpen}
            onOpenChange={setCounterOfferOpen}
            timeSlotSettings={timeSlotSettings}
            customerName={selectedRequest.customerName}
            requestedSlots={selectedRequest.requestedTimeSlots}
            onSubmit={handleSubmitCounterOffer}
            loading={loading}
          />
        </>
      )}
    </>
  );
};
