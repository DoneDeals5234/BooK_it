import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle } from 'lucide-react';
import { generateTimeSlots, formatTime } from '@/lib/time-slot-utils';
import type { TimeSlotSetting } from '@/lib/shops-storage';

interface TimeSlotSelectorProps {
  timeSlotSettings: TimeSlotSetting[] | undefined;
  selectedSlots: string[];
  onSlotSelect: (slot: string) => void;
  onSlotDeselect: (slot: string) => void;
  onConfirm: () => void;
  loading?: boolean;
  minSlots?: number;
  maxSlots?: number;
}

export const TimeSlotSelector = ({
  timeSlotSettings,
  selectedSlots,
  onSlotSelect,
  onSlotDeselect,
  onConfirm,
  loading = false,
  minSlots = 1,
  maxSlots = 3,
}: TimeSlotSelectorProps) => {
  const availableSlots = useMemo(() => generateTimeSlots(timeSlotSettings), [timeSlotSettings]);

  if (!timeSlotSettings || timeSlotSettings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center py-6">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-semibold">No Time Slots Available</p>
              <p className="text-sm text-muted-foreground">The shop hasn't configured time slots yet. Please contact them directly.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center py-6">
            <Clock className="h-8 w-8 text-gray-400" />
            <div>
              <p className="font-semibold">No Slots Available Today</p>
              <p className="text-sm text-muted-foreground">All time slots are booked. Try booking for another day.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSlotSelected = (slot: string) => selectedSlots.includes(slot);
  const canSelectMore = selectedSlots.length < maxSlots;
  const isMinimumMet = selectedSlots.length >= minSlots;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Select Your Preferred Time</CardTitle>
        <CardDescription>
          Choose {minSlots} to {maxSlots} time slot{maxSlots !== 1 ? 's' : ''} for your booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="flex gap-2 bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            {selectedSlots.length === 0
              ? 'Select at least one preferred time slot'
              : selectedSlots.length === maxSlots
              ? 'Maximum slots selected'
              : `${maxSlots - selectedSlots.length} more slot${maxSlots - selectedSlots.length !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Time Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {availableSlots.map((slot) => (
            <button
              key={slot.time}
              onClick={() => {
                if (isSlotSelected(slot.time)) {
                  onSlotDeselect(slot.time);
                } else if (canSelectMore) {
                  onSlotSelect(slot.time);
                }
              }}
              disabled={!isSlotSelected(slot.time) && !canSelectMore}
              className={`
                p-2 sm:p-3 rounded-lg border-2 transition-all text-sm font-medium
                ${
                  isSlotSelected(slot.time)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 text-foreground'
                }
                ${!isSlotSelected(slot.time) && !canSelectMore ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-xs sm:text-sm">{slot.label}</div>
            </button>
          ))}
        </div>

        {/* Selected Slots Display */}
        {selectedSlots.length > 0 && (
          <div className="bg-muted p-3 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">SELECTED SLOTS</p>
            <div className="flex flex-wrap gap-2">
              {selectedSlots.map((slot) => (
                <div
                  key={slot}
                  className="flex items-center gap-2 bg-background px-3 py-1 rounded border border-primary"
                >
                  <span className="text-sm font-medium">{formatTime(slot)}</span>
                  <button
                    onClick={() => onSlotDeselect(slot)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onConfirm}
            disabled={!isMinimumMet || loading}
            className="flex-1"
          >
            {loading ? 'Sending Request...' : `Request Booking (${selectedSlots.length}/${maxSlots})`}
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-muted-foreground text-center">
          The shop owner will respond within 1 minute. If no response, you can contact them directly.
        </p>
      </CardContent>
    </Card>
  );
};
