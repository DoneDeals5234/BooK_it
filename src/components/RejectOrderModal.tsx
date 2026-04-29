import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { REJECTION_REASONS } from '@/lib/supabase-orders';

interface RejectOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes?: string) => Promise<void>;
  customerName?: string;
}

export const RejectOrderModal = ({
  isOpen,
  onClose,
  onConfirm,
  customerName = 'Customer'
}: RejectOrderModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setSelectedReason('');
    setCustomNotes('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedReason) {
      setError('Please select a rejection reason');
      return;
    }

    if (selectedReason === 'custom' && !customNotes.trim()) {
      setError('Please enter a custom reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reason = selectedReason === 'custom' ? 'custom' : selectedReason;
      const notes = selectedReason === 'custom' ? customNotes : REJECTION_REASONS[selectedReason as keyof typeof REJECTION_REASONS];
      
      await onConfirm(reason, notes);
      toast.success('Order rejected successfully');
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject order';
      setError(errorMessage);
      toast.error('Failed to reject order: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Order</DialogTitle>
          <DialogDescription>
            Reject order from {customerName}. Please select a reason for rejection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rejection Reasons */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Reason</p>
            <RadioGroup value={selectedReason} onValueChange={(value) => {
              setSelectedReason(value);
              setError('');
            }}>
              {Object.entries(REJECTION_REASONS).map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="cursor-pointer flex-1 m-0">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Notes for Custom Reason */}
          {selectedReason === 'custom' && (
            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Label htmlFor="custom-notes">Custom Reason</Label>
              <Textarea
                id="custom-notes"
                placeholder="Explain why you're rejecting this order..."
                value={customNotes}
                onChange={(e) => {
                  setCustomNotes(e.target.value);
                  setError('');
                }}
                disabled={loading}
                className="min-h-20 resize-none"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex gap-2 items-start bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedReason}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Order'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
