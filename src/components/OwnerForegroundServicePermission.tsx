import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { checkOwnerForegroundServicePermission, setOwnerForegroundServicePermission } from '@/lib/owner-permissions';
import toast from 'react-hot-toast';

interface OwnerForegroundServicePermissionProps {
  shopId: string;
  shopName: string;
  onPermissionChange?: (hasPermission: boolean) => void;
}

/**
 * APPROACH 1: Permission component for shop owners
 * Allows owners to grant/revoke permission for automatic foreground service start
 * 
 * This ensures owners are aware that:
 * 1. We will start a service on their device when customers book
 * 2. The service monitors appointment times
 * 3. The service sends them reminders
 */
export const OwnerForegroundServicePermission: React.FC<OwnerForegroundServicePermissionProps> = ({
  shopId,
  shopName,
  onPermissionChange,
}) => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check current permission status
  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const permission = await checkOwnerForegroundServicePermission(user.uid, shopId);
        setHasPermission(permission);
      } catch (error) {
        console.error('Error checking permission:', error);
        toast.error('Failed to check permission status');
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user?.uid, shopId]);

  // Handle permission toggle
  const handleToggle = async (newValue: boolean) => {
    if (!user?.uid) {
      toast.error('You must be logged in');
      return;
    }

    setIsSaving(true);
    try {
      const success = await setOwnerForegroundServicePermission(user.uid, shopId, newValue);

      if (success) {
        setHasPermission(newValue);
        onPermissionChange?.(newValue);
        
        if (newValue) {
          toast.success('Permission granted! You will receive automatic appointment reminders.');
        } else {
          toast.success('Permission revoked. You will no longer receive automatic reminders.');
        }
      } else {
        toast.error('Failed to update permission');
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('An error occurred while updating permission');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Bell className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Automatic Appointment Service
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            For: <span className="font-semibold">{shopName}</span>
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded p-4 mb-4 border border-blue-100">
        <p className="text-sm text-gray-700 mb-3">
          When customers book appointments with you, our system can automatically:
        </p>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">✓</span>
            <span>Start a foreground service on your device</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">✓</span>
            <span>Monitor appointment times in real-time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">✓</span>
            <span>Send you automatic reminders when customers arrive</span>
          </li>
        </ul>
      </div>

      {/* Warning for disabled state */}
      {!hasPermission && (
        <div className="bg-amber-50 rounded p-3 mb-4 border border-amber-200 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Without this permission, you won't receive automatic appointment reminders. You'll need to manually check your bookings.
          </p>
        </div>
      )}

      {/* Permission Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">
            {hasPermission ? '✅ Permission Granted' : '❌ Permission Not Granted'}
          </p>
          <p className="text-sm text-gray-600">
            {hasPermission
              ? 'We can automatically start services for your appointments'
              : 'Grant permission to enable automatic services'}
          </p>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => handleToggle(!hasPermission)}
          disabled={isSaving}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            hasPermission
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isSaving ? 'Saving...' : hasPermission ? 'Revoke' : 'Grant Permission'}
        </button>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500 mt-4">
        Your device must have notification permissions enabled for this feature to work properly.
      </p>
    </div>
  );
};
