import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

export const UpdatePopup = () => {
  return null; // Forcefully disabled as per user request to move to Hamburger Menu
  const { hasUpdate, updateData, localVersion } = useAppUpdate();

  // Check if user has already dismissed this version
  useEffect(() => {
    if (hasUpdate && updateData?.latest_version) {
      const dismissedVersion = localStorage.getItem('dismissed_update_version');
      // Only show if not dismissed OR if a new version is available (newer than dismissed)
      const shouldShow = dismissedVersion !== updateData.latest_version;
      setIsOpen(shouldShow);
    }
  }, [hasUpdate, updateData?.latest_version]);

  const handleUpdate = () => {
    if (updateData?.apk_url) {
      // Use native bridge if available for automatic download and install
      const alarmBridge = (window as any).AlarmBridge;
      if (alarmBridge && typeof alarmBridge.downloadAndInstallApk === 'function') {
        console.log('Using native bridge to download and install APK');
        alarmBridge.downloadAndInstallApk(updateData.apk_url);
        toast.success('Downloading update... Please follow the installation prompts when finished.');
      } else {
        // Fallback to manual download
        console.log('Native bridge not found, falling back to manual download');
        window.open(updateData.apk_url, '_blank');
      }
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    if (updateData?.latest_version) {
      localStorage.setItem('dismissed_update_version', updateData.latest_version);
    }
  };

  if (!hasUpdate) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-sm z-[100]">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            <AlertDialogTitle>Update Available</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="text-base">
          {updateData?.update_message ||
            'A new version of the app is available. Please update to get the latest features and improvements.'}
        </AlertDialogDescription>
        <div className="mt-2 text-sm text-gray-600">
          <p>Installed version: {localVersion}</p>
          <p>Latest version: {updateData?.latest_version}</p>
        </div>
        <div className="flex gap-3 mt-6">
          <AlertDialogCancel onClick={handleDismiss}>
            Dismiss
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">
            Update Now
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
