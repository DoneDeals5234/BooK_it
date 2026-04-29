import { Order, formatOrderDate } from '@/lib/supabase-orders';
import { Check, Clock, X, Package, CheckCircle } from 'lucide-react';

interface OrderTimelineProps {
  order: Order;
}

export const OrderTimeline = ({ order }: OrderTimelineProps) => {
  const timeline = [
    {
      label: 'Order Placed',
      date: order.created_at,
      completed: true,
      icon: Package,
      color: 'bg-blue-500'
    },
    {
      label: order.status === 'rejected' ? 'Order Rejected' : 'Order Accepted',
      date: order.accepted_at || order.rejected_at,
      completed: order.status !== 'pending',
      icon: order.status === 'rejected' ? X : Check,
      color: order.status === 'rejected' ? 'bg-red-500' : 'bg-green-500'
    },
    {
      label: 'Ready for Collection',
      date: order.ready_at,
      completed: order.status === 'ready_for_collection' || order.status === 'collected',
      icon: Clock,
      color: 'bg-yellow-500'
    },
    {
      label: 'Collected',
      date: order.collected_at,
      completed: order.status === 'collected',
      icon: CheckCircle,
      color: 'bg-green-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-1 bg-gray-200 dark:bg-gray-700"></div>

        {/* Timeline Items */}
        <div className="space-y-8">
          {timeline.map((item, index) => {
            const Icon = item.icon;
            const isCompleted = item.completed && item.date;

            return (
              <div key={index} className="relative pl-24">
                {/* Icon Circle */}
                <div
                  className={`absolute left-2 top-1 w-12 h-12 rounded-full ${
                    isCompleted ? item.color : 'bg-gray-300 dark:bg-gray-600'
                  } flex items-center justify-center text-white shadow-lg z-10`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                  {isCompleted ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatOrderDate(item.date)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500">Pending</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejection Reason Display */}
      {order.status === 'rejected' && order.rejection_notes && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 mt-4">
          <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-800 dark:text-red-300">{order.rejection_notes}</p>
        </div>
      )}

      {/* Order Details Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Order Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Order Amount</span>
            <span className="font-medium text-gray-900 dark:text-white">₹{order.order_amount.toFixed(2)}</span>
          </div>
          {order.order_description && (
            <div className="flex justify-between items-start">
              <span className="text-gray-600 dark:text-gray-400">Notes</span>
              <span className="font-medium text-gray-900 dark:text-white text-right">{order.order_description}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Order ID</span>
            <span className="font-mono text-gray-900 dark:text-white text-xs">{order.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
