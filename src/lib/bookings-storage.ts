import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

export interface Booking {
  id: string;
  shopId: string;
  serviceName: string;
  servicePrice: string;
  timeSlot: string;
  tokenNumber: number;
  userName: string;
  userPhone: string;
  bookingDate: string;
  createdAt: Date;
  status: 'pending' | 'in-progress' | 'completed';
  userId?: string;
}

const BOOKINGS_STORAGE_KEY = 'barber_bookings';
const LAST_RESET_DATE_KEY = 'barber_bookings_last_reset';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFl6WVSCNKZPIaKEr0Ern_Xbb20oIRxa-3sexJRQsHJhflH1pBAJHLhCT4l0oxANQt/exec';

// Get bookings from localStorage
export const getBookings = (): Booking[] => {
  try {
    checkAndResetDailyTokens();
    const stored = localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((booking: any) => ({
        ...booking,
        createdAt: new Date(booking.createdAt),
      }));
    }
  } catch (error) {
    console.error('Error reading bookings from storage:', error);
  }
  return [];
};

// Check if daily reset is needed (1 AM reset)
const checkAndResetDailyTokens = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
  
  const lastResetDate = localStorage.getItem(LAST_RESET_DATE_KEY);
  
  if (lastResetDate !== today) {
    // Clear all bookings from previous day
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(LAST_RESET_DATE_KEY, today);
  }
};

// Save bookings to localStorage
export const saveBookings = (bookings: Booking[]): void => {
  try {
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
  } catch (error) {
    console.error('Error saving bookings to storage:', error);
  }
};

// Get next token number for a shop
export const getNextTokenNumber = (shopId: string): number => {
  const bookings = getBookings();
  const shopBookings = bookings.filter(b => b.shopId === shopId);
  if (shopBookings.length === 0) return 1;
  const maxToken = Math.max(...shopBookings.map(b => b.tokenNumber));
  return maxToken + 1;
};

// Check if time slot is already booked
export const isTimeSlotBooked = (shopId: string, timeSlot: string): boolean => {
  const bookings = getBookings();
  return bookings.some(b => b.shopId === shopId && b.timeSlot === timeSlot);
};

// Get all available time slots (9 AM to 11 PM with 45-minute gaps)
export const getAvailableTimeSlots = (shopId: string): string[] => {
  const slots: string[] = [];
  let hour = 9;
  let minute = 0;

  while (hour < 23 || (hour === 23 && minute === 0)) {
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!isTimeSlotBooked(shopId, timeString)) {
      slots.push(timeString);
    }

    minute += 45;
    if (minute >= 60) {
      minute -= 60;
      hour += 1;
    }

    if (hour > 23) break;
  }

  return slots;
};

// Get all time slots (including booked ones, for display purposes)
export const getAllTimeSlots = (): string[] => {
  const slots: string[] = [];
  let hour = 9;
  let minute = 0;

  while (hour < 23 || (hour === 23 && minute === 0)) {
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push(timeString);

    minute += 45;
    if (minute >= 60) {
      minute -= 60;
      hour += 1;
    }

    if (hour > 23) break;
  }

  return slots;
};

// Get booked tokens for a shop
export const getShopBookings = (shopId: string): Booking[] => {
  const bookings = getBookings();
  return bookings.filter(b => b.shopId === shopId).sort((a, b) => a.tokenNumber - b.tokenNumber);
};

// Add a new booking
export const addBooking = (booking: Omit<Booking, 'id' | 'createdAt'>): Booking => {
  const newBooking: Booking = {
    ...booking,
    id: Date.now().toString(),
    createdAt: new Date(),
  };

  const bookings = getBookings();
  bookings.push(newBooking);
  saveBookings(bookings);

  return newBooking;
};

// Get booking by ID
export const getBookingById = (id: string): Booking | null => {
  const bookings = getBookings();
  return bookings.find(b => b.id === id) || null;
};

// Update booking status
export const updateBookingStatus = (
  id: string,
  status: 'pending' | 'in-progress' | 'completed'
): Booking | null => {
  const bookings = getBookings();
  const booking = bookings.find(b => b.id === id);

  if (!booking) return null;

  booking.status = status;
  saveBookings(bookings);

  return booking;
};

// Get booking status summary for a shop (for token display)
export const getTokenStatus = (shopId: string): { in_progress: Booking | null; pending: Booking[] } => {
  const bookings = getShopBookings(shopId);
  const inProgress = bookings.find(b => b.status === 'in-progress') || null;
  const pending = bookings.filter(b => b.status === 'pending').sort((a, b) => a.tokenNumber - b.tokenNumber);

  return { in_progress: inProgress, pending };
};

// Get current time in IST
export const getCurrentISTTime = (): Date => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return istTime;
};

// Get current date in IST
export const getCurrentISTDate = (): string => {
  const now = getCurrentISTTime();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Fetch all bookings from Google Apps Script API
export const fetchBookingsFromAPI = async (): Promise<Booking[]> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.debug('API returned non-OK status:', response.statusText);
        return [];
      }

      const data = await response.json();

      // Convert API response to Booking format
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id || Date.now().toString(),
          shopId: item.shopId,
          serviceName: item.serviceName || item.service || '',
          servicePrice: item.servicePrice || item.price || '',
          timeSlot: item.timeSlot || item.time || '',
          tokenNumber: item.tokenNumber || item.token || 0,
          userName: item.userName || item.name || '',
          userPhone: item.userPhone || item.phone || '',
          bookingDate: item.bookingDate || item.date || '',
          createdAt: new Date(item.createdAt || Date.now()),
          status: item.status || 'pending',
        }));
      }

      return [];
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.debug('API fetch skipped (expected in development):', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
};

// Post a new booking to Google Apps Script API
export const postBookingToAPI = async (booking: Omit<Booking, 'id' | 'createdAt'>): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(booking),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.debug('API returned non-OK status:', response.statusText);
        return false;
      }

      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.debug('API post skipped (expected in development):', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};

// Check if a time slot is currently running (within 45 minutes from start time)
export const isTimeSlotRunningNow = (timeSlot: string): boolean => {
  const now = getCurrentISTTime();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const [slotHour, slotMinute] = timeSlot.split(':').map(Number);

  // Convert to total minutes for easier comparison
  const slotStartMinutes = slotHour * 60 + slotMinute;
  const slotEndMinutes = slotStartMinutes + 45;
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  return currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes;
};

// Save a booking to Firestore
export const saveBookingToFirestore = async (booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string | null> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 5000)
    );

    const savePromise = addDoc(collection(db, 'bookings'), {
      ...booking,
      createdAt: new Date(),
    });

    const docRef = await Promise.race([savePromise, timeoutPromise]);
    console.log('Booking saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.debug('Firestore save skipped (local copy saved):', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

// Fetch all bookings from Firestore
export const fetchBookingsFromFirestore = async (): Promise<Booking[]> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 5000)
    );

    const fetchPromise = (async () => {
      const q = query(collection(db, 'bookings'));
      return await getDocs(q);
    })();

    const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);

    const bookings: Booking[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      bookings.push({
        id: doc.id,
        shopId: data.shopId || '',
        serviceName: data.serviceName || '',
        servicePrice: data.servicePrice || '',
        timeSlot: data.timeSlot || '',
        tokenNumber: data.tokenNumber || 0,
        userName: data.userName || '',
        userPhone: data.userPhone || '',
        bookingDate: data.bookingDate || '',
        createdAt: data.createdAt?.toDate?.() || new Date(),
        status: data.status || 'pending',
      });
    });

    return bookings;
  } catch (error) {
    console.debug('Firestore fetch skipped:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
};

// Subscribe to real-time bookings updates
export const subscribeToBookings = (callback: (bookings: Booking[]) => void): Unsubscribe => {
  try {
    const q = query(collection(db, 'bookings'));

    return onSnapshot(q, (querySnapshot) => {
      const bookings: Booking[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        bookings.push({
          id: doc.id,
          shopId: data.shopId || '',
          serviceName: data.serviceName || '',
          servicePrice: data.servicePrice || '',
          timeSlot: data.timeSlot || '',
          tokenNumber: data.tokenNumber || 0,
          userName: data.userName || '',
          userPhone: data.userPhone || '',
          bookingDate: data.bookingDate || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          status: data.status || 'pending',
        });
      });
      callback(bookings);
    }, (error) => {
      console.debug('Firestore subscription error (using local bookings):', error instanceof Error ? error.message : 'Unknown error');
    });
  } catch (error) {
    console.debug('Failed to set up Firestore subscription:', error);
    // Return a no-op unsubscribe function
    return () => {};
  }
};
