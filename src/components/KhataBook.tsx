import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Phone, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getKhataBookCustomers,
  addKhataBookCustomer,
  deleteKhataBookCustomer,
  recordKhataBookPayment,
  getKhataBookStats,
  type KhataBookCustomer,
} from '@/lib/supabase-khata-book';

interface KhataBookProps {
  shopId: string;
}

export const KhataBook = ({ shopId }: KhataBookProps) => {
  const [customers, setCustomers] = useState<KhataBookCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<KhataBookCustomer | null>(null);
  const [stats, setStats] = useState({ totalCustomers: 0, activeCustomers: 0, totalOutstanding: 0, totalCollected: 0 });

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, [shopId]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const [customersData, statsData] = await Promise.all([
        getKhataBookCustomers(shopId),
        getKhataBookStats(shopId),
      ]);
      setCustomers(customersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      const newCustomer = await addKhataBookCustomer(
        shopId,
        customerName.trim(),
        phoneNumber.trim() || null,
        amountNum
      );

      setCustomers([newCustomer, ...customers]);
      setStats({ ...stats, totalCustomers: stats.totalCustomers + 1, activeCustomers: stats.activeCustomers + 1, totalOutstanding: stats.totalOutstanding + amountNum });

      // Reset form
      setCustomerName('');
      setPhoneNumber('');
      setAmount('');
      setShowAddCustomerDialog(false);
      toast.success('Customer added successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error adding customer:', errorMessage);
      toast.error(`Failed to add customer: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) return;

    const paymentAmountNum = parseFloat(paymentAmount);
    if (!paymentAmount || isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmountNum > selectedCustomer.remaining_amount) {
      toast.error(`Payment cannot exceed remaining amount of ₹${selectedCustomer.remaining_amount.toFixed(2)}`);
      return;
    }

    try {
      setSubmitting(true);
      await recordKhataBookPayment(selectedCustomer.id, shopId, paymentAmountNum, paymentNotes.trim() || undefined);

      // Update local state
      const newRemaining = Math.max(0, selectedCustomer.remaining_amount - paymentAmountNum);
      const newStatus = newRemaining === 0 ? 'settled' as const : 'pending' as const;

      const updatedCustomer: KhataBookCustomer = {
        ...selectedCustomer,
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      setCustomers(customers.map(c => (c.id === selectedCustomer.id ? updatedCustomer : c)));
      setSelectedCustomer(updatedCustomer);

      // Update stats
      setStats({
        ...stats,
        totalOutstanding: stats.totalOutstanding - paymentAmountNum,
        totalCollected: stats.totalCollected + paymentAmountNum,
        activeCustomers: newStatus === 'settled' ? stats.activeCustomers - 1 : stats.activeCustomers,
      });

      setPaymentAmount('');
      setPaymentNotes('');
      setShowPaymentDialog(false);
      toast.success(`Payment of ₹${paymentAmountNum.toFixed(2)} recorded!`);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!window.confirm('Are you sure you want to delete this customer record?')) return;

    try {
      const customerToDelete = customers.find(c => c.id === customerId);
      if (!customerToDelete) return;

      await deleteKhataBookCustomer(customerId);
      setCustomers(customers.filter(c => c.id !== customerId));

      // Update stats
      setStats({
        ...stats,
        totalCustomers: stats.totalCustomers - 1,
        activeCustomers: customerToDelete.status === 'pending' ? stats.activeCustomers - 1 : stats.activeCustomers,
        totalOutstanding: stats.totalOutstanding - customerToDelete.remaining_amount,
        totalCollected: stats.totalCollected - (customerToDelete.total_amount_to_collect - customerToDelete.remaining_amount),
      });

      toast.success('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const handleOpenPaymentDialog = (customer: KhataBookCustomer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setPaymentNotes('');
    setShowPaymentDialog(true);
  };

  const handleCallCustomer = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading khata book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Customers</p>
              <p className="text-xl sm:text-3xl font-bold">{stats.totalCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Active</p>
              <p className="text-xl sm:text-3xl font-bold text-blue-600">{stats.activeCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Outstanding</p>
              <p className="text-xl sm:text-3xl font-bold text-orange-600">₹{stats.totalOutstanding.toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Collected</p>
              <p className="text-xl sm:text-3xl font-bold text-green-600">₹{stats.totalCollected.toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Customer Button */}
      <Button
        onClick={() => setShowAddCustomerDialog(true)}
        className="w-full sm:w-auto"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Customer
      </Button>

      {/* Customers List */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No customers yet. Add one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {customers.map((customer) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <Card className="hover:shadow-md transition-shadow border-slate-100 dark:border-slate-800 overflow-hidden">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Customer Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg">{customer.customer_name}</h3>
                          <Badge variant={customer.status === 'settled' ? 'default' : 'secondary'}>
                            {customer.status === 'settled' ? (
                              <>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Settled
                              </>
                            ) : (
                              <>
                                <Clock className="mr-1 h-3 w-3" />
                                Pending
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          {customer.phone_number && (
                            <p>📱 {customer.phone_number}</p>
                          )}
                          <p>Total to collect: ₹{customer.total_amount_to_collect.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Remaining</p>
                          <button
                            onClick={() => customer.status !== 'settled' && handleOpenPaymentDialog(customer)}
                            disabled={customer.status === 'settled'}
                            className={`text-2xl font-bold ${
                              customer.remaining_amount > 0 ? 'text-orange-600 hover:underline cursor-pointer' : 'text-green-600'
                            } ${customer.status === 'settled' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            ₹{customer.remaining_amount.toFixed(2)}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          {customer.phone_number && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCallCustomer(customer.phone_number!)}
                              title="Call customer"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer.id)}
                            title="Delete customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Add a customer to your khata book and track their outstanding amount.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div>
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone-number">Phone Number (Optional)</Label>
              <Input
                id="phone-number"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                type="tel"
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount to Collect *</Label>
              <div className="flex gap-2">
                <span className="flex items-center">₹</span>
                <Input
                  id="amount"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddCustomerDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Adding...' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedCustomer && `Payment for ${selectedCustomer.customer_name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining Amount</p>
                <p className="text-3xl font-bold text-orange-600">
                  ₹{selectedCustomer.remaining_amount.toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="payment-amount">Payment Amount *</Label>
                <div className="flex gap-2">
                  <span className="flex items-center">₹</span>
                  <Input
                    id="payment-amount"
                    placeholder={`Max: ₹${selectedCustomer.remaining_amount.toFixed(2)}`}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedCustomer.remaining_amount}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Input
                  id="payment-notes"
                  placeholder="Add any notes about this payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 Current date and time will be automatically recorded with this payment.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPaymentDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Recording...' : 'Record Payment'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
