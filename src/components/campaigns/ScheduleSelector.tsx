import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Zap } from 'lucide-react';

interface ScheduleSelectorProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

export const ScheduleSelector = ({ value, onChange }: ScheduleSelectorProps) => {
  const handleSendNow = () => {
    onChange(null);
  };

  const handleSchedule = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeString = e.target.value;
    if (dateTimeString) {
      const date = new Date(dateTimeString);
      onChange(date);
    }
  };

  // Get minimum datetime (now + 1 minute)
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  const minDateTime = now.toISOString().slice(0, 16);

  // Get current value in datetime-local format
  const currentValue = value
    ? value.toISOString().slice(0, 16)
    : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Delivery Option</CardTitle>
        <CardDescription>Choose when to send your campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Send Now */}
          <button
            onClick={handleSendNow}
            className={`p-4 rounded-lg border-2 transition-colors ${
              !value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-muted bg-background hover:bg-muted'
            }`}
          >
            <Zap className={`h-5 w-5 mx-auto mb-2 ${!value ? 'text-blue-600' : 'text-muted-foreground'}`} />
            <p className="font-semibold text-sm">Send Now</p>
            <p className="text-xs text-muted-foreground mt-1">Immediate delivery</p>
          </button>

          {/* Schedule */}
          <button
            onClick={() => {
              const futureDate = new Date();
              futureDate.setHours(futureDate.getHours() + 1);
              onChange(futureDate);
            }}
            className={`p-4 rounded-lg border-2 transition-colors ${
              value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-muted bg-background hover:bg-muted'
            }`}
          >
            <Clock className={`h-5 w-5 mx-auto mb-2 ${value ? 'text-blue-600' : 'text-muted-foreground'}`} />
            <p className="font-semibold text-sm">Schedule</p>
            <p className="text-xs text-muted-foreground mt-1">Send later</p>
          </button>
        </div>

        {/* Schedule Date/Time Picker */}
        {value && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="schedule-datetime">Select Date & Time</Label>
            <Input
              id="schedule-datetime"
              type="datetime-local"
              value={currentValue}
              onChange={handleSchedule}
              min={minDateTime}
              className="w-full"
            />
            {value && (
              <p className="text-xs text-muted-foreground">
                Scheduled for: {value.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
