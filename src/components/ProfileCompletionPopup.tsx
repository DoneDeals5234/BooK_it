import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileCompletionPopupProps {
  onClose?: () => void;
  onNavigateToProfile?: () => void;
}

export const ProfileCompletionPopup = ({
  onClose,
  onNavigateToProfile,
}: ProfileCompletionPopupProps) => {
  const { user } = useAuth();
  const { profile, profileComplete, loading } = useUserProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show popup after login if profile is not complete AND not loading
    if (!loading && user && !profileComplete) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setOpen(false);
    }
  }, [user, profileComplete, loading]);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleNavigateToProfile = () => {
    setOpen(false);
    onNavigateToProfile?.();
  };

  if (!user) return null;

  const firstLetter = user.email?.[0]?.toUpperCase() || '?';
  const getBackgroundColor = (letter: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-600">Complete Your Profile</DialogTitle>
          <DialogDescription>
            Let's get you set up! Add your profile information to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          {profile?.imageUrl ? (
            <img
              src={profile.imageUrl}
              alt="Profile"
              className="h-24 w-24 rounded-full object-cover border-4 border-blue-500"
            />
          ) : (
            <div
              className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-white ${getBackgroundColor(
                firstLetter
              )} border-4 border-blue-500`}
            >
              {firstLetter}
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold">{user.email}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap the circle button to complete your profile
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50">
            Later
          </Button>
          <Button onClick={handleNavigateToProfile} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            Complete Profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
