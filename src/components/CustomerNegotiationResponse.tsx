import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Check, X } from 'lucide-react';
import { formatTime } from '@/lib/time-slot-utils';
import type { BookingNegotiation } from '@/contexts/BookingNegotiationContext';

interface CustomerNegotiationResponseProps {
  negotiation: BookingNegotiation;
  secondsRemaining: number;
  onAccept: (selectedTime: string) => void;
  onReject: () => void;
}

export const CustomerNegotiationResponse = ({
  negotiation,
  secondsRemaining,
  onAccept,
  onReject,
}: CustomerNegotiationResponseProps) => {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(secondsRemaining);

  useEffect(() => {
    setDisplaySeconds(secondsRemaining);
  }, [secondsRemaining]);

  const getCountdownColor = () => {
    if (displaySeconds <= 10) return 'text-red-600 dark:text-red-400';
    if (displaySeconds <= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-spin" />
            <h3 className="font-semibold text-lg">Owner Sent Counter-Offer</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            The shop owner has proposed alternative times for your booking
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Accept within:</p>
            <p className={`text-2xl font-bold ${getCountdownColor()}`}>{displaySeconds}s</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-full transition-all duration-1000 ${
                displaySeconds <= 10 ? 'bg-red-600' : 'bg-orange-600'
              }`}
              style={{ width: `${(displaySeconds / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Offered Times - Selection */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Choose one of the offered times:</p>
          <div className="grid grid-cols-2 gap-2">
            {negotiation.offeredTimes.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                className={`
                  p-3 rounded-lg border-2 transition-all text-center
                  ${
                    selectedTime === slot
                      ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-400'
                  }
                `}
              >
                <div className="font-semibold text-sm">{formatTime(slot)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded flex gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">You have 1 minute to respond</p>
            <p className="text-xs mt-1">Once you accept a time, the booking will be confirmed.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => {
              if (selectedTime) {
                onAccept(selectedTime);
              }
            }}
            disabled={!selectedTime}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Accept Time
          </Button>
          <Button
            variant="destructive"
            onClick={onReject}
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            Reject Offer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
