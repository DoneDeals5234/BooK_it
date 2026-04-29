import { useEffect, useState, useCallback } from 'react';
import {
  startReminderMonitoring,
  handleCustomerConfirmation,
  handleCustomerCancellation,
  type PendingReminder,
} from '@/lib/booking-reminder-service';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';

export const useBookingReminder = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [activeReminder, setActiveReminder] = useState<PendingReminder | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Handle reminder confirmation
  const confirmReminder = useCallback(
    async (reminder: PendingReminder) => {
      const success = await handleCustomerConfirmation(
        reminder.bookingId,
        reminder.shopId,
        profile?.name || 'Customer',
        reminder.serviceName
      );

      if (success) {
        setActiveReminder(null);
      }

      return success;
    },
    [profile]
  );

  // Handle reminder cancellation
  const cancelReminder = useCallback(async (reminder: PendingReminder) => {
    const success = await handleCustomerCancellation(reminder.bookingId);

    if (success) {
      setActiveReminder(null);
    }

    return success;
  }, []);

  // Start reminder monitoring on mount
  useEffect(() => {
    if (!user) return;

    setIsMonitoring(true);

    const handleReminderReady = (reminder: PendingReminder) => {
      // Only show reminders for this user
      if (reminder.userId === user.uid) {
        setActiveReminder(reminder);
      }
    };

    const stopMonitoring = startReminderMonitoring(handleReminderReady);

    return () => {
      stopMonitoring();
      setIsMonitoring(false);
    };
  }, [user]);

  return {
    activeReminder,
    isMonitoring,
    confirmReminder,
    cancelReminder,
  };
};
