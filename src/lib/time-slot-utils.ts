import type { TimeSlotSetting } from './shops-storage';

export interface TimeSlot {
  time: string; // HH:MM format
  label: string;
  isAvailable: boolean;
}

/**
 * Generate available time slots based on time slot settings
 */
export const generateTimeSlots = (settings: TimeSlotSetting[] | undefined): TimeSlot[] => {
  if (!settings || settings.length === 0) {
    return [];
  }

  const slots: TimeSlot[] = [];

  settings.forEach((setting) => {
    if (!setting.enabled) return;

    const startHours = parseInt(setting.startTime.split(':')[0]);
    const startMinutes = parseInt(setting.startTime.split(':')[1]);
    const endHours = parseInt(setting.endTime.split(':')[0]);
    const endMinutes = parseInt(setting.endTime.split(':')[1]);

    let currentHours = startHours;
    let currentMinutes = startMinutes;

    const endTotalMinutes = endHours * 60 + endMinutes;
    let currentTotalMinutes = currentHours * 60 + currentMinutes;

    while (currentTotalMinutes < endTotalMinutes) {
      const timeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
      const hour12 = currentHours % 12 || 12;
      const ampm = currentHours >= 12 ? 'PM' : 'AM';
      const label = `${hour12.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')} ${ampm}`;

      slots.push({
        time: timeStr,
        label,
        isAvailable: true,
      });

      currentMinutes += setting.slotDurationMinutes;
      if (currentMinutes >= 60) {
        currentHours += Math.floor(currentMinutes / 60);
        currentMinutes = currentMinutes % 60;
      }
      currentTotalMinutes += setting.slotDurationMinutes;
    }
  });

  return slots;
};

/**
 * Format time string from HH:MM to readable format
 */
export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour12 = parseInt(hours) % 12 || 12;
  const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Validate time slot settings
 */
export const isValidTimeSlotSetting = (setting: TimeSlotSetting): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timeRegex.test(setting.startTime) || !timeRegex.test(setting.endTime)) {
    return false;
  }

  const [startHours, startMinutes] = setting.startTime.split(':').map(Number);
  const [endHours, endMinutes] = setting.endTime.split(':').map(Number);

  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  if (startTotal >= endTotal) {
    return false;
  }

  if (setting.slotDurationMinutes <= 0 || setting.slotDurationMinutes > 240) {
    return false;
  }

  return true;
};
