import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Phone, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BookingRequest } from '@/contexts/BookingNegotiationContext';

interface CustomerNegotiationWaitingProps {
  request: BookingRequest;
  secondsRemaining: number;
  onCancel: () => void;
  onContactOwner?: () => void;
}

export const CustomerNegotiationWaiting = ({
  request,
  secondsRemaining,
  onCancel,
  onContactOwner,
}: CustomerNegotiationWaitingProps) => {
  const [showOwnerNotResponding, setShowOwnerNotResponding] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(secondsRemaining);

  useEffect(() => {
    setDisplaySeconds(secondsRemaining);
    
    // Show owner not responding popup when timeout occurs
    if (secondsRemaining <= 0) {
      setShowOwnerNotResponding(true);
    }
  }, [secondsRemaining]);

  const formatTime = (slot: string) => {
    const [h, m] = slot.split(':');
    const hour12 = parseInt(h) % 12 || 12;
    const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const getProgressPercentage = () => {
    const totalSeconds = 60;
    return (displaySeconds / totalSeconds) * 100;
  };

  return (
    <>
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <h3 className="font-semibold text-lg">Please Wait for Owner Response</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Your booking request has been sent to the shop owner
            </p>
          </div>

          {/* Request Details */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg space-y-2">
            <p className="text-sm">
              <span className="font-semibold">Service:</span> {request.serviceName}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Price:</span> {request.servicePrice}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Preferred Times:</span>{' '}
              {request.requestedTimeSlots.map(formatTime).join(', ')}
            </p>
          </div>

          {/* Countdown Timer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Owner Response Countdown</p>
              <p className={`text-2xl font-bold ${displaySeconds <= 10 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {displaySeconds}s
              </p>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  displaySeconds <= 10 ? 'bg-red-600' : 'bg-green-600'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Owner has 1 minute to respond</p>
              <p className="text-xs mt-1">If they don't respond, you can contact them directly or cancel the request.</p>
            </div>
          </div>

          {/* Cancel Button */}
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            Cancel Request
          </Button>
        </CardContent>
      </Card>

      {/* Owner Not Responding Dialog */}
      <Dialog open={showOwnerNotResponding} onOpenChange={setShowOwnerNotResponding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Owner Not Responding</DialogTitle>
            <DialogDescription>
              The shop owner didn't respond in time. You can contact them directly or try again later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contact Options */}
            <div className="space-y-2">
              {request.customerPhone && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => {
                    window.location.href = `tel:${request.customerPhone}`;
                  }}
                >
                  <Phone className="h-4 w-4" />
                  <span>Call Owner</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Send Message</span>
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowOwnerNotResponding(false);
                  onCancel();
                }}
                className="flex-1"
              >
                Cancel Request
              </Button>
              <Button
                onClick={() => setShowOwnerNotResponding(false)}
                className="flex-1"
              >
                Keep Waiting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
