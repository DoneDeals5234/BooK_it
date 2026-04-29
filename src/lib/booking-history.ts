export interface BookingHistoryItem {
  id: string;
  bookingId: string;
  shopId: string;
  shopName: string;
  tokenNumber: number;
  timeSlot: string;
  bookingDate: string;
  status: 'completed' | 'cancelled' | 'in-progress' | 'pending';
  createdAt: number;
}

const STORAGE_KEY = 'barber_booking_history';

export const getBookingHistory = (userId: string): BookingHistoryItem[] => {
  try {
    const allHistory = localStorage.getItem(STORAGE_KEY);
    if (!allHistory) return [];

    const history = JSON.parse(allHistory) as Record<string, BookingHistoryItem[]>;
    return history[userId] || [];
  } catch (error) {
    console.error('Error reading booking history:', error);
    return [];
  }
};

export const addBookingToHistory = (userId: string, booking: Omit<BookingHistoryItem, 'id' | 'createdAt'>) => {
  try {
    const allHistory = localStorage.getItem(STORAGE_KEY);
    let history: Record<string, BookingHistoryItem[]> = {};

    if (allHistory) {
      history = JSON.parse(allHistory);
    }

    if (!history[userId]) {
      history[userId] = [];
    }

    const newBooking: BookingHistoryItem = {
      ...booking,
      id: `${userId}-${Date.now()}`,
      createdAt: Date.now(),
    };

    history[userId].push(newBooking);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    return newBooking;
  } catch (error) {
    console.error('Error adding booking to history:', error);
    return null;
  }
};

export const updateBookingInHistory = (userId: string, bookingId: string, status: BookingHistoryItem['status']) => {
  try {
    const allHistory = localStorage.getItem(STORAGE_KEY);
    if (!allHistory) return false;

    const history = JSON.parse(allHistory) as Record<string, BookingHistoryItem[]>;
    if (!history[userId]) return false;

    const booking = history[userId].find(b => b.bookingId === bookingId);
    if (booking) {
      booking.status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating booking in history:', error);
    return false;
  }
};

export const clearBookingHistory = (userId: string) => {
  try {
    const allHistory = localStorage.getItem(STORAGE_KEY);
    if (!allHistory) return true;

    const history = JSON.parse(allHistory) as Record<string, BookingHistoryItem[]>;
    delete history[userId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    return true;
  } catch (error) {
    console.error('Error clearing booking history:', error);
    return false;
  }
};

export const deleteBooking = (userId: string, bookingId: string) => {
  try {
    const allHistory = localStorage.getItem(STORAGE_KEY);
    if (!allHistory) return false;

    const history = JSON.parse(allHistory) as Record<string, BookingHistoryItem[]>;
    if (!history[userId]) return false;

    history[userId] = history[userId].filter(b => b.id !== bookingId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    return true;
  } catch (error) {
    console.error('Error deleting booking from history:', error);
    return false;
  }
};
