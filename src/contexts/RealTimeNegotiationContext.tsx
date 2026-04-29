import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface NegotiationState {
  requestId: string | null;
  status: 'idle' | 'customer_selecting_time' | 'owner_responding' | 'owner_offering_time' | 'customer_responding_to_offer' | 'completed' | 'expired';
  customerTimeSelection: string | null; // Time slot selected by customer
  ownerResponse: 'confirmed' | 'rejected' | 'offer_alternative' | null;
  ownerOfferedTimes: string[] | null;
  customerResponseToOffer: 'accepted' | 'rejected' | null;
  finalBookingTime: string | null;
  startedAt: number | null;
  ownerNotificationSentAt: number | null;
  ownerResponseDeadline: number | null; // 1 minute from owner notification
  customerOfferResponseDeadline: number | null; // 1 minute from owner offer
  customerWaitDeadline: number | null; // 60 seconds from customer time selection
  totalDeadline: number | null; // 2 minutes from start
  ownerIgnoredResponse: boolean;
  errorMessage: string | null;
}

interface RealTimeNegotiationContextType {
  negotiationState: NegotiationState;
  startNegotiation: (requestId: string) => void;
  setCustomerTimeSelection: (time: string) => void;
  setOwnerResponse: (response: 'confirmed' | 'rejected' | 'offer_alternative') => void;
  setOwnerOfferedTimes: (times: string[]) => void;
  setCustomerResponseToOffer: (response: 'accepted' | 'rejected') => void;
  setFinalBookingTime: (time: string) => void;
  markOwnerIgnored: () => void;
  completeNegotiation: () => void;
  expireNegotiation: () => void;
  resetNegotiation: () => void;
  getTimeRemainingSeconds: (deadline: number | null) => number;
  isOwnerResponseExpired: () => boolean;
  isCustomerOfferResponseExpired: () => boolean;
  isCustomerWaitExpired: () => boolean;
  isTotalDeadlineExpired: () => boolean;
}

const RealTimeNegotiationContext = createContext<RealTimeNegotiationContextType | undefined>(undefined);

const initialState: NegotiationState = {
  requestId: null,
  status: 'idle',
  customerTimeSelection: null,
  ownerResponse: null,
  ownerOfferedTimes: null,
  customerResponseToOffer: null,
  finalBookingTime: null,
  startedAt: null,
  ownerNotificationSentAt: null,
  ownerResponseDeadline: null,
  customerOfferResponseDeadline: null,
  customerWaitDeadline: null,
  totalDeadline: null,
  ownerIgnoredResponse: false,
  errorMessage: null,
};

export const RealTimeNegotiationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NegotiationState>(initialState);

  const startNegotiation = useCallback((requestId: string) => {
    const now = Date.now();
    setState({
      ...initialState,
      requestId,
      status: 'customer_selecting_time',
      startedAt: now,
      totalDeadline: now + 2 * 60 * 1000, // 2 minutes
    });
  }, []);

  const setCustomerTimeSelection = useCallback((time: string) => {
    const now = Date.now();
    setState((prev) => ({
      ...prev,
      customerTimeSelection: time,
      status: 'owner_responding',
      ownerNotificationSentAt: now,
      ownerResponseDeadline: now + 1 * 60 * 1000, // 1 minute
      customerWaitDeadline: now + 60 * 1000, // 60 seconds
    }));
  }, []);

  const setOwnerResponse = useCallback((response: 'confirmed' | 'rejected' | 'offer_alternative') => {
    if (response === 'confirmed') {
      setState((prev) => ({
        ...prev,
        ownerResponse: response,
        status: 'completed',
        finalBookingTime: prev.customerTimeSelection,
      }));
    } else if (response === 'offer_alternative') {
      setState((prev) => ({
        ...prev,
        ownerResponse: response,
        status: 'owner_offering_time',
      }));
    } else {
      // rejected
      setState((prev) => ({
        ...prev,
        ownerResponse: response,
        status: 'expired',
      }));
    }
  }, []);

  const setOwnerOfferedTimes = useCallback((times: string[]) => {
    const now = Date.now();
    setState((prev) => ({
      ...prev,
      ownerOfferedTimes: times,
      status: 'customer_responding_to_offer',
      customerOfferResponseDeadline: now + 1 * 60 * 1000, // 1 minute
    }));
  }, []);

  const setCustomerResponseToOffer = useCallback((response: 'accepted' | 'rejected') => {
    if (response === 'accepted') {
      setState((prev) => ({
        ...prev,
        customerResponseToOffer: response,
        status: 'completed',
        finalBookingTime: prev.ownerOfferedTimes?.[0] || null, // Use first offered time if accepted
      }));
    } else {
      setState((prev) => ({
        ...prev,
        customerResponseToOffer: response,
        status: 'expired',
      }));
    }
  }, []);

  const setFinalBookingTime = useCallback((time: string) => {
    setState((prev) => ({
      ...prev,
      finalBookingTime: time,
    }));
  }, []);

  const markOwnerIgnored = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ownerIgnoredResponse: true,
      status: 'expired',
    }));
  }, []);

  const completeNegotiation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'completed',
    }));
  }, []);

  const expireNegotiation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'expired',
    }));
  }, []);

  const resetNegotiation = useCallback(() => {
    setState(initialState);
  }, []);

  const getTimeRemainingSeconds = useCallback((deadline: number | null) => {
    if (!deadline) return 0;
    const remaining = Math.max(0, deadline - Date.now());
    return Math.ceil(remaining / 1000);
  }, []);

  const isOwnerResponseExpired = useCallback(() => {
    if (!state.ownerResponseDeadline) return false;
    return Date.now() > state.ownerResponseDeadline;
  }, [state.ownerResponseDeadline]);

  const isCustomerOfferResponseExpired = useCallback(() => {
    if (!state.customerOfferResponseDeadline) return false;
    return Date.now() > state.customerOfferResponseDeadline;
  }, [state.customerOfferResponseDeadline]);

  const isCustomerWaitExpired = useCallback(() => {
    if (!state.customerWaitDeadline) return false;
    return Date.now() > state.customerWaitDeadline;
  }, [state.customerWaitDeadline]);

  const isTotalDeadlineExpired = useCallback(() => {
    if (!state.totalDeadline) return false;
    return Date.now() > state.totalDeadline;
  }, [state.totalDeadline]);

  const value: RealTimeNegotiationContextType = {
    negotiationState: state,
    startNegotiation,
    setCustomerTimeSelection,
    setOwnerResponse,
    setOwnerOfferedTimes,
    setCustomerResponseToOffer,
    setFinalBookingTime,
    markOwnerIgnored,
    completeNegotiation,
    expireNegotiation,
    resetNegotiation,
    getTimeRemainingSeconds,
    isOwnerResponseExpired,
    isCustomerOfferResponseExpired,
    isCustomerWaitExpired,
    isTotalDeadlineExpired,
  };

  return (
    <RealTimeNegotiationContext.Provider value={value}>
      {children}
    </RealTimeNegotiationContext.Provider>
  );
};

export const useRealTimeNegotiation = () => {
  const context = useContext(RealTimeNegotiationContext);
  if (!context) {
    throw new Error('useRealTimeNegotiation must be used within RealTimeNegotiationProvider');
  }
  return context;
};
