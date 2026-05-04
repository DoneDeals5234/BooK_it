import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (otp: string) => Promise<void>;
  customerName: string;
}

export const OtpVerificationModal = ({ isOpen, onClose, onConfirm, customerName }: OtpVerificationModalProps) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) return;
    
    setLoading(true);
    try {
      await onConfirm(otp);
      setOtp('');
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
          </div>
          <DialogTitle className="text-center font-black text-xl">Verify Delivery</DialogTitle>
          <DialogDescription className="text-center font-medium">
            Please ask <strong>{customerName}</strong> for the 4-digit OTP shown in their app to confirm delivery.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="flex justify-center">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="0000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              className="text-center text-3xl font-black h-16 w-48 tracking-[0.5em] rounded-2xl border-2 focus:border-indigo-500 focus:ring-indigo-500"
              autoFocus
              required
            />
          </div>

          <DialogFooter className="sm:justify-center">
            <Button 
              type="submit" 
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-100"
              disabled={otp.length !== 4 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  VERIFYING...
                </>
              ) : (
                'CONFIRM DELIVERY'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
