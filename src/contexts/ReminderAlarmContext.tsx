import React, { createContext, useContext, useState, useCallback } from 'react';
import type { LocalReminder } from '@/lib/local-reminders';

interface ReminderAlarmContextType {
  activeReminder: LocalReminder | null;
  setActiveReminder: (reminder: LocalReminder | null) => void;
  dismissReminder: () => void;
}

const ReminderAlarmContext = createContext<ReminderAlarmContextType | undefined>(undefined);

export const ReminderAlarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeReminder, setActiveReminder] = useState<LocalReminder | null>(null);

  const dismissReminder = useCallback(() => {
    setActiveReminder(null);
  }, []);

  return (
    <ReminderAlarmContext.Provider
      value={{
        activeReminder,
        setActiveReminder,
        dismissReminder,
      }}
    >
      {children}
    </ReminderAlarmContext.Provider>
  );
};

export const useReminderAlarm = () => {
  const context = useContext(ReminderAlarmContext);
  if (!context) {
    throw new Error('useReminderAlarm must be used within ReminderAlarmProvider');
  }
  return context;
};
