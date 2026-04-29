import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { generateTimeSlots, formatTime } from '@/lib/time-slot-utils';
import type { TimeSlotSetting } from '@/lib/shops-storage';

interface OwnerCounterOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeSlotSettings: TimeSlotSetting[] | undefined;
  customerName: string;
  requestedSlots: string[];
  onSubmit: (offeredTimes: string[]) => void;
  loading?: boolean;
}

export const OwnerCounterOfferModal = ({
  open,
  onOpenChange,
  timeSlotSettings,
  customerName,
  requestedSlots,
  onSubmit,
  loading = false,
}: OwnerCounterOfferModalProps) => {
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const availableSlots = useMemo(() => generateTimeSlots(timeSlotSettings), [timeSlotSettings]);

  const handleSelectTime = (slot: string) => {
    if (selectedTimes.includes(slot)) {
      setSelectedTimes(selectedTimes.filter((s) => s !== slot));
    } else if (selectedTimes.length < 3) {
      setSelectedTimes([...selectedTimes, slot]);
    }
  };

  const handleSubmit = () => {
    if (selectedTimes.length > 0) {
      onSubmit(selectedTimes);
      setSelectedTimes([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Counter-Offer to {customerName}</DialogTitle>
          <DialogDescription>
            Select alternative time slots to offer to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer's Requested Times */}
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">CUSTOMER REQUESTED</p>
            <div className="flex flex-wrap gap-2">
              {requestedSlots.map((slot) => (
                <span key={slot} className="bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-3 py-1 rounded text-sm font-medium">
                  {formatTime(slot)}
                </span>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="flex gap-2 bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Select 1-3 alternative time slots. Customer will receive these options and has 1 minute to accept.
            </p>
          </div>

          {/* Available Time Slots */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Select Alternative Times</p>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => handleSelectTime(slot.time)}
                  className={`
                    p-2 rounded border-2 transition-all text-sm font-medium
                    ${
                      selectedTimes.includes(slot.time)
                        ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
                        : 'border-gray-200 dark:border-gray-700 hover:border-green-400'
                    }
                    ${selectedTimes.length >= 3 && !selectedTimes.includes(slot.time) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  disabled={selectedTimes.length >= 3 && !selectedTimes.includes(slot.time)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Times Summary */}
          {selectedTimes.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-2">
                OFFERING {selectedTimes.length} SLOT{selectedTimes.length !== 1 ? 'S' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTimes.map((slot) => (
                  <div
                    key={slot}
                    className="flex items-center gap-1 bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100 px-2 py-1 rounded text-sm"
                  >
                    <span>{formatTime(slot)}</span>
                    <button
                      onClick={() => handleSelectTime(slot)}
                      className="ml-1 hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTimes([]);
                onOpenChange(false);
              }}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedTimes.length === 0 || loading}
              className="flex-1"
            >
              {loading ? 'Sending...' : `Send Offer (${selectedTimes.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
