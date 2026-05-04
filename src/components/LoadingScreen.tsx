import './SandclockAnimation.css';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-4">
        {/* 3D Sandclock Container */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping" />
          <img 
            src="/running_boy_vector_1777764287799.png" 
            alt="Loading" 
            className="w-32 h-32 object-contain relative z-10 animate-bounce"
            onError={(e) => {
              // Fallback to a placeholder if the local file isn't found
              (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png';
            }}
          />
        </div>

        <div className="text-center">
          <p className="text-white text-lg font-semibold">Initializing...</p>
          <p className="text-slate-400 text-sm mt-2">Setting up notifications</p>
        </div>
      </div>
    </div>
  );
}
