const SUPABASE_EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-action`;

export interface SendSMSParams {
  toPhoneNumber: string;
  tokenNumber: number;
  shopName: string;
  timeSlot: string;
  serviceName: string;
}

/**
 * Send booking confirmation SMS via Supabase Edge Function
 * Edge Function handles Twilio API calls securely on the backend
 */
export const sendBookingConfirmationSMS = async ({
  toPhoneNumber,
  tokenNumber,
  shopName,
  timeSlot,
  serviceName,
}: SendSMSParams): Promise<boolean> => {
  try {
    console.log('Attempting to send SMS via Edge Function...');
    console.log('URL:', SUPABASE_EDGE_FUNCTION_URL);

    const response = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toPhoneNumber,
        tokenNumber,
        shopName,
        timeSlot,
        serviceName,
      }),
    });

    if (!response.ok) {
      let error: any = {};
      try {
        error = await response.json();
      } catch {
        error = { statusText: response.statusText, status: response.status };
      }
      console.error('SMS service error:', error);
      console.error('Response status:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('SMS sent successfully:', data.sid);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return false;
  }
};
