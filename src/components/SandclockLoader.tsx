import './SandclockAnimation.css';

interface SandclockLoaderProps {
  message?: string;
  submessage?: string;
  size?: 'small' | 'medium' | 'large';
}

export function SandclockLoader({ 
  message = 'Loading...', 
  submessage = 'Please wait',
  size = 'medium'
}: SandclockLoaderProps) {
  const sizeClasses = {
    small: 'w-12 h-16 sm:w-14 sm:h-20',
    medium: 'w-16 h-24 sm:w-20 sm:h-32',
    large: 'w-24 h-32 sm:w-32 sm:h-48',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* 3D Sandclock Container */}
      <div className={`${sizeClasses[size]} perspective`}>
        <div className="sandclock-container">
          {/* Top Chamber */}
          <div className="sandclock-chamber top-chamber">
            <div className="sand-top"></div>
          </div>

          {/* Middle Connector */}
          <div className="sandclock-connector">
            <div className="sand-falling"></div>
          </div>

          {/* Bottom Chamber */}
          <div className="sandclock-chamber bottom-chamber">
            <div className="sand-bottom"></div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-foreground text-sm sm:text-base font-semibold">{message}</p>
        {submessage && <p className="text-muted-foreground text-xs sm:text-sm mt-1">{submessage}</p>}
      </div>
    </div>
  );
}
