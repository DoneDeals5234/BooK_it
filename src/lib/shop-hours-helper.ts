import type { TimeSlotSetting } from './shops-storage';

/**
 * Check if the shop should be open based on current time and time slot settings
 */
export const shouldShopBeOpen = (timeSlotSettings: TimeSlotSetting[] | undefined): boolean => {
  if (!timeSlotSettings || timeSlotSettings.length === 0) {
    return false;
  }

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  // Check if current time falls within any enabled time slot
  for (const setting of timeSlotSettings) {
    if (!setting.enabled) continue;

    const [startHours, startMinutes] = setting.startTime.split(':').map(Number);
    const [endHours, endMinutes] = setting.endTime.split(':').map(Number);

    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
      return true;
    }
  }

  return false;
};

/**
 * Get the next shop opening time
 */
export const getNextOpeningTime = (timeSlotSettings: TimeSlotSetting[] | undefined): string | null => {
  if (!timeSlotSettings || timeSlotSettings.length === 0) {
    return null;
  }

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  // Get all enabled time slots and sort by start time
  const enabledSlots = timeSlotSettings
    .filter(s => s.enabled)
    .map(s => {
      const [hours, minutes] = s.startTime.split(':').map(Number);
      return {
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        timeInMinutes: hours * 60 + minutes
      };
    })
    .sort((a, b) => a.timeInMinutes - b.timeInMinutes);

  // Find the first slot that starts after current time
  for (const slot of enabledSlots) {
    if (slot.timeInMinutes > currentTimeInMinutes) {
      return slot.time;
    }
  }

  // If no slot found today, return the first slot (tomorrow)
  return enabledSlots.length > 0 ? enabledSlots[0].time : null;
};
