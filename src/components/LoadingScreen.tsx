import './SandclockAnimation.css';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-4">
        {/* 3D Sandclock Container */}
        <div className="w-20 h-24 sm:w-24 sm:h-32 perspective">
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
          <p className="text-white text-lg font-semibold">Initializing...</p>
          <p className="text-slate-400 text-sm mt-2">Setting up notifications</p>
        </div>
      </div>
    </div>
  );
}
