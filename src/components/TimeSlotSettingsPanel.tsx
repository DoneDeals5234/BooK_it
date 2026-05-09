import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle, Clock, CalendarCheck, Edit } from 'lucide-react';
import type { TimeSlotSetting } from '@/lib/shops-storage';
import { isValidTimeSlotSetting } from '@/lib/time-slot-utils';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';

interface TimeSlotSettingsPanelProps {
  timeSlotSettings: TimeSlotSetting[];
  openingTime: string;
  closingTime: string;
  isTokenBookingEnabled?: boolean;
  onChange: (updates: { 
    timeSlotSettings?: TimeSlotSetting[]; 
    openingTime?: string; 
    closingTime?: string;
    isTokenBookingEnabled?: boolean;
  }) => void;
}

export const TimeSlotSettingsPanel = ({ 
  timeSlotSettings, 
  openingTime, 
  closingTime, 
  isTokenBookingEnabled = false,
  onChange 
}: TimeSlotSettingsPanelProps) => {
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
    onChange({ timeSlotSettings: settings });
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
    onChange({ timeSlotSettings: settings });
    setEditingIndex(null);
    toast.success('Time slot updated');
  };

  const handleRemoveSetting = (index: number) => {
    const settings = timeSlotSettings.filter((_, i) => i !== index);
    onChange({ timeSlotSettings: settings });
    toast.success('Time slot removed');
  };

  const calculateSlotCount = (startTime: string, endTime: string, duration: number): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    return Math.floor((endTotal - startTotal) / duration);
  };

  return (
    <div className="space-y-4">
      {/* Shop Hours Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-2xl flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" />
            Shop Business Hours
          </CardTitle>
          <CardDescription>Set your regular shop opening and closing times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening-time" className="font-bold">Shop Open Time</Label>
              <Input
                id="opening-time"
                type="time"
                value={openingTime}
                onChange={(e) => onChange({ openingTime: e.target.value })}
                className="h-12 text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing-time" className="font-bold">Shop Close Time</Label>
              <Input
                id="closing-time"
                type="time"
                value={closingTime}
                onChange={(e) => onChange({ closingTime: e.target.value })}
                className="h-12 text-lg font-semibold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Enable Toggle */}
      <Card className={`${isTokenBookingEnabled ? 'border-red-200' : 'opacity-80'}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-0.5">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-red-500" />
              Token Booking System
            </CardTitle>
            <CardDescription>
              Allow customers to book time slots online
            </CardDescription>
          </div>
          <Switch
            checked={isTokenBookingEnabled}
            onCheckedChange={(enabled) => onChange({ isTokenBookingEnabled: enabled })}
          />
        </CardHeader>
        <CardContent>
          {!isTokenBookingEnabled ? (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed text-center">
              <p className="text-sm text-muted-foreground font-medium">
                Token booking is currently disabled. Enable it to configure available time slots for your customers.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Info Banner */}
              <div className="flex gap-3 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  Time slots are exclusive - only one customer can book each slot.
                </div>
              </div>

              {/* Existing Settings */}
              {timeSlotSettings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm">Configured Time Slots</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {timeSlotSettings.map((setting, index) => (
                      <div key={index} className="border rounded-xl p-3 sm:p-4 bg-white dark:bg-slate-900 shadow-sm">
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
                                  className="w-full h-10 px-2 py-2 border rounded-md text-sm"
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
                                <label className="flex items-center gap-2 cursor-pointer pb-2">
                                  <input
                                    type="checkbox"
                                    checked={setting.enabled}
                                    onChange={() =>
                                      handleUpdateSetting(index, { ...setting, enabled: !setting.enabled })
                                    }
                                    className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500"
                                  />
                                  <span className="text-sm font-medium">Active</span>
                                </label>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingIndex(null)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setEditingIndex(null)}
                                className="flex-1 bg-red-500 hover:bg-red-600"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-bold text-sm flex items-center gap-2">
                                {setting.startTime} - {setting.endTime}
                                {setting.enabled ? (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">Active</span>
                                ) : (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black uppercase">Inactive</span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-medium">
                                {setting.slotDurationMinutes} min per slot | {calculateSlotCount(setting.startTime, setting.endTime, setting.slotDurationMinutes)} slots total
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingIndex(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSetting(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
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
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-sm">Add New Booking Period</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="start-time" className="text-[11px] font-black uppercase text-muted-foreground">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newSetting.startTime}
                      onChange={(e) => setNewSetting({ ...newSetting, startTime: e.target.value })}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-time" className="text-[11px] font-black uppercase text-muted-foreground">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={newSetting.endTime}
                      onChange={(e) => setNewSetting({ ...newSetting, endTime: e.target.value })}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slot-duration" className="text-[11px] font-black uppercase text-muted-foreground">Slot Duration</Label>
                  <select
                    id="slot-duration"
                    value={newSetting.slotDurationMinutes}
                    onChange={(e) =>
                      setNewSetting({ ...newSetting, slotDurationMinutes: parseInt(e.target.value) })
                    }
                    className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-white dark:bg-slate-950"
                  >
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>
                <Button onClick={handleAddSetting} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-11" variant="default">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Booking Period
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
