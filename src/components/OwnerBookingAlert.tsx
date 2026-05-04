import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Clock, IndianRupee, User, Phone, Check, X } from 'lucide-react';
import type { BookingRequest } from '@/contexts/BookingNegotiationContext';

interface OwnerBookingAlertProps {
  request: BookingRequest | null;
  secondsRemaining: number;
  onConfirm: () => void;
  onReject: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OwnerBookingAlert = ({
  request,
  secondsRemaining,
  onConfirm,
  onReject,
  open,
  onOpenChange,
}: OwnerBookingAlertProps) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(secondsRemaining);

  useEffect(() => {
    setDisplaySeconds(secondsRemaining);
    
    // Switch to full-screen alert after 30 seconds of inactivity
    if (secondsRemaining > 0 && secondsRemaining <= 30 && !showFullScreen) {
      setShowFullScreen(true);
    }
    
    // Auto-close alert when time expires
    if (secondsRemaining <= 0 && open) {
      onOpenChange(false);
      setShowFullScreen(false);
    }
  }, [secondsRemaining, open, onOpenChange, showFullScreen]);

  if (!request) return null;

  const formatTime = (slot: string) => {
    const [h, m] = slot.split(':');
    const hour12 = parseInt(h) % 12 || 12;
    const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const getCountdownColor = () => {
    if (displaySeconds <= 10) return 'text-red-600 dark:text-red-400';
    if (displaySeconds <= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Full-screen alert (after 30 seconds)
  if (showFullScreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg border-2 border-red-500 dark:border-red-400 max-w-[95vw] mx-auto">
          <div className="space-y-4">
            {/* Blinking Alert Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full animate-pulse" />
                <div className="relative bg-red-600 dark:bg-red-500 text-white p-4 rounded-full">
                  <Bell className="h-8 w-8 animate-bounce" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">Customer Booking Request!</h2>
              <p className="text-sm text-muted-foreground">Please respond immediately</p>
            </div>

            {/* Countdown - Large */}
            <div className="text-center">
              <p className={`text-6xl font-bold ${getCountdownColor()} animate-pulse`}>
                {displaySeconds}
              </p>
              <p className="text-sm text-muted-foreground mt-2">seconds remaining</p>
            </div>

            {/* Customer Details */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">CUSTOMER</p>
                  <p className="font-semibold">{request.customerName}</p>
                  <p className="text-sm text-muted-foreground">{request.customerPhone}</p>
                </div>
              </div>

              <div className="border-t" />

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">PREFERRED TIMES</p>
                  <div className="space-y-1">
                    {request.requestedTimeSlots.map((slot) => (
                      <p key={slot} className="font-medium">
                        {formatTime(slot)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t" />

              <div className="flex items-start gap-3">
                <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">SERVICE</p>
                  <p className="font-semibold">{request.serviceName}</p>
                  <p className="text-sm">{request.servicePrice}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Large and Prominent */}
            <div className="flex flex-col gap-2 pt-4">
              <Button
                size="lg"
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-lg h-14"
              >
                <Check className="mr-2 h-5 w-5" />
                Confirm Booking
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={() => {
                  onReject();
                  onOpenChange(false);
                }}
                className="w-full text-lg h-14"
              >
                <X className="mr-2 h-5 w-5" />
                Reject & Counter-Offer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Standard notification (first 30 seconds)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-bounce" />
            <DialogTitle>New Booking Request</DialogTitle>
          </div>
          <DialogDescription>
            A customer wants to book an appointment
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="space-y-4">
            {/* Countdown */}
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Respond within:</span>
              <span className={`text-2xl font-bold ${getCountdownColor()}`}>{displaySeconds}s</span>
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">CUSTOMER</p>
                <p className="font-semibold">{request.customerName}</p>
                <p className="text-sm text-muted-foreground">{request.customerPhone}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground">SERVICE</p>
                <p className="font-semibold">{request.serviceName}</p>
                <p className="text-sm text-muted-foreground">{request.servicePrice}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground">PREFERRED TIMES</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {request.requestedTimeSlots.map((slot) => (
                    <span key={slot} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                      {formatTime(slot)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Confirm
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onReject();
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center">
              Don't respond? Full-screen alert coming in {30 - displaySeconds}s
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
