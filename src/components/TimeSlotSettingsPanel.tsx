import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import type { TimeSlotSetting } from '@/lib/shops-storage';
import { isValidTimeSlotSetting } from '@/lib/time-slot-utils';
import toast from 'react-hot-toast';

interface TimeSlotSettingsPanelProps {
  timeSlotSettings: TimeSlotSetting[];
  onChange: (settings: TimeSlotSetting[]) => void;
}

export const TimeSlotSettingsPanel = ({ timeSlotSettings, onChange }: TimeSlotSettingsPanelProps) => {
  const [newSetting, setNewSetting] = useState<TimeSlotSetting>({
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 10,
    enabled: true,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddSetting = () => {
    if (!isValidTimeSlotSetting(newSetting)) {
      toast.error('Invalid time slot settings. Please check your input.');
      return;
    }

    const settings = [...timeSlotSettings, newSetting];
    onChange(settings);
    setNewSetting({
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 10,
      enabled: true,
    });
    toast.success('Time slot added');
  };

  const handleUpdateSetting = (index: number, updated: TimeSlotSetting) => {
    if (!isValidTimeSlotSetting(updated)) {
      toast.error('Invalid time slot settings. Please check your input.');
      return;
    }

    const settings = timeSlotSettings.map((s, i) => (i === index ? updated : s));
    onChange(settings);
    setEditingIndex(null);
    toast.success('Time slot updated');
  };

  const handleRemoveSetting = (index: number) => {
    const settings = timeSlotSettings.filter((_, i) => i !== index);
    onChange(settings);
    toast.success('Time slot removed');
  };

  const handleToggleSetting = (index: number) => {
    const settings = timeSlotSettings.map((s, i) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    onChange(settings);
  };

  const calculateSlotCount = (startTime: string, endTime: string, duration: number): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    return Math.floor((endTotal - startTotal) / duration);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-2xl">Time Slot Settings</CardTitle>
        <CardDescription>Configure available booking time slots for customers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Info Banner */}
        <div className="flex gap-3 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            Time slots are exclusive - only one customer can book each slot. Slot duration is <strong>10 minutes</strong>.
          </div>
        </div>

        {/* Existing Settings */}
        {timeSlotSettings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Current Time Slots</h3>
            <div className="space-y-2">
              {timeSlotSettings.map((setting, index) => (
                <div key={index} className="border rounded-lg p-3 sm:p-4">
                  {editingIndex === index ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <Label className="text-xs">Start Time</Label>
                          <Input
                            type="time"
                            value={setting.startTime}
                            onChange={(e) =>
                              handleUpdateSetting(index, { ...setting, startTime: e.target.value })
                            }
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End Time</Label>
                          <Input
                            type="time"
                            value={setting.endTime}
                            onChange={(e) =>
                              handleUpdateSetting(index, { ...setting, endTime: e.target.value })
                            }
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <Label className="text-xs">Slot Duration (min)</Label>
                          <select
                            value={setting.slotDurationMinutes}
                            onChange={(e) =>
                              handleUpdateSetting(index, {
                                ...setting,
                                slotDurationMinutes: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-2 border rounded text-sm"
                          >
                            <option value="10">10 min</option>
                            <option value="15">15 min</option>
                            <option value="20">20 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">60 min</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={setting.enabled}
                              onChange={() =>
                                handleUpdateSetting(index, { ...setting, enabled: !setting.enabled })
                              }
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Enabled</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {setting.startTime} - {setting.endTime}
                          {setting.enabled ? (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                          ) : (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Inactive</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          Duration: {setting.slotDurationMinutes} min | Slots: {calculateSlotCount(setting.startTime, setting.endTime, setting.slotDurationMinutes)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingIndex(index)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSetting(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Setting */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold text-sm">Add New Time Slot</h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <Label htmlFor="start-time" className="text-xs">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={newSetting.startTime}
                onChange={(e) => setNewSetting({ ...newSetting, startTime: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="end-time" className="text-xs">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={newSetting.endTime}
                onChange={(e) => setNewSetting({ ...newSetting, endTime: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="slot-duration" className="text-xs">Slot Duration (minutes)</Label>
            <select
              id="slot-duration"
              value={newSetting.slotDurationMinutes}
              onChange={(e) =>
                setNewSetting({ ...newSetting, slotDurationMinutes: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          <Button onClick={handleAddSetting} className="w-full" variant="default">
            <Plus className="mr-2 h-4 w-4" />
            Add Time Slot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
