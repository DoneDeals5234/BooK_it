import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Camera, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { updateOrderPaymentScreenshot } from '@/lib/supabase-orders';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  upiId: string;
  shopName: string;
  onSuccess: () => void;
}

export const UpiPaymentModal = ({ isOpen, onClose, orderId, amount, upiId, shopName, onSuccess }: UpiPaymentModalProps) => {
  const [step, setStep] = useState<'timer' | 'upload' | 'success'>('timer');
  const [timer, setTimer] = useState(3);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && step === 'timer' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && step === 'timer') {
      handleOpenUpi();
      setStep('upload');
    }
    return () => clearInterval(interval);
  }, [isOpen, timer, step]);

  const handleOpenUpi = () => {
    // UPI deep link format: upi://pay?pa=address@upi&pn=PayeeName&am=Amount&cu=INR
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Order ' + orderId.slice(0, 8))}`;
    window.open(upiLink, '_blank');
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size too large (max 5MB)');
      return;
    }

    setUploading(true);
    try {
      const fileName = `payment_screenshots/${orderId}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(fileName);

      await updateOrderPaymentScreenshot(orderId, publicUrl);
      setStep('success');
      toast.success('Payment details submitted for verification!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      toast.error('Failed to upload screenshot');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !uploading && onClose()}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" />
            Advance Payment
          </DialogTitle>
          <DialogDescription className="text-center font-medium">
            {shopName} requires advance payment for this order.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'timer' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center border-4 border-indigo-600">
                <span className="text-4xl font-black text-indigo-600">{timer}</span>
              </div>
              <p className="text-sm font-bold text-slate-600 text-center animate-pulse">
                Opening UPI App in {timer} seconds...
              </p>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 font-bold leading-tight">
                  IMPORTANT: After successful payment, take a SCREENSHOT and upload it here to confirm your order.
                </p>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center bg-indigo-50 p-4 rounded-2xl border-2 border-dashed border-indigo-200">
                <p className="text-xs font-bold text-indigo-700 mb-1">Paying Amount</p>
                <p className="text-3xl font-black text-indigo-900">₹{amount.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-black text-slate-700">Step 2: Upload Payment Screenshot</p>
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer bg-slate-50 overflow-hidden relative">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                      <p className="text-xs font-bold text-slate-500">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-500">Tap to select screenshot</p>
                      <input type="file" className="hidden" accept="image/*" onChange={handleScreenshotUpload} />
                    </>
                  )}
                </label>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl text-slate-600 font-bold"
                onClick={handleOpenUpi}
              >
                Pay Again (If app didn't open)
              </Button>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Submitted!</h3>
              <p className="text-sm text-slate-600 text-center font-medium">
                The shop owner will verify your payment soon.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            className="w-full text-slate-500 font-bold" 
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
