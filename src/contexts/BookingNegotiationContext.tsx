import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BookingRequest {
  id: string;
  shopId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  servicePrice: string;
  requestedTimeSlots: string[]; // Array of time slots in HH:MM format
  status: 'pending_owner_response' | 'owner_confirmed' | 'owner_rejected' | 'counter_offered' | 'pending_customer_response' | 'confirmed' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
}

export interface BookingNegotiation {
  id: string;
  bookingRequestId: string;
  offeredTimes: string[]; // Array of time slots in HH:MM format
  offeredBy: 'owner' | 'customer';
  responseStatus: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

interface BookingNegotiationContextType {
  // Current active negotiation (from customer or owner perspective)
  activeRequest: BookingRequest | null;
  activeNegotiation: BookingNegotiation | null;
  
  // Notifications/Alerts
  incomingAlert: {
    type: 'booking_request' | 'counter_offer' | 'owner_not_responding' | 'offer_expired' | null;
    request?: BookingRequest;
    negotiation?: BookingNegotiation;
    expiresAt?: Date;
  };
  
  // Actions
  setActiveRequest: (request: BookingRequest | null) => void;
  setActiveNegotiation: (negotiation: BookingNegotiation | null) => void;
  setIncomingAlert: (alert: any) => void;
  
  // Countdown/Timer
  secondsRemaining: number;
  setSecondsRemaining: (seconds: number) => void;
  
  // Utilities
  clearNegotiation: () => void;
  isNegotiationActive: () => boolean;
}

const BookingNegotiationContext = createContext<BookingNegotiationContextType | undefined>(undefined);

export const useBookingNegotiation = () => {
  const context = useContext(BookingNegotiationContext);
  if (!context) {
    throw new Error('useBookingNegotiation must be used within BookingNegotiationProvider');
  }
  return context;
};

export const BookingNegotiationProvider = ({ children }: { children: ReactNode }) => {
  const [activeRequest, setActiveRequest] = useState<BookingRequest | null>(null);
  const [activeNegotiation, setActiveNegotiation] = useState<BookingNegotiation | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<any>({
    type: null,
  });
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const clearNegotiation = useCallback(() => {
    setActiveRequest(null);
    setActiveNegotiation(null);
    setIncomingAlert({ type: null });
    setSecondsRemaining(0);
  }, []);

  const isNegotiationActive = useCallback(() => {
    return (
      activeRequest !== null ||
      activeNegotiation !== null ||
      incomingAlert.type !== null
    );
  }, [activeRequest, activeNegotiation, incomingAlert.type]);

  return (
    <BookingNegotiationContext.Provider
      value={{
        activeRequest,
        activeNegotiation,
        incomingAlert,
        setActiveRequest,
        setActiveNegotiation,
        setIncomingAlert,
        secondsRemaining,
        setSecondsRemaining,
        clearNegotiation,
        isNegotiationActive,
      }}
    >
      {children}
    </BookingNegotiationContext.Provider>
  );
};
