import React from 'react';

interface AnimatedCreatureProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
  opacity?: number;
}

const sizeMap = {
  sm: 'w-12 h-12',
  md: 'w-24 h-24',
  lg: 'w-40 h-40',
  xl: 'w-56 h-56',
};

export const AnimatedCreature: React.FC<AnimatedCreatureProps> = ({
  size = 'md',
  className = '',
  color = 'text-pink-400',
  opacity = 1,
}) => {
  return (
    <div className={`${sizeMap[size]} ${className} relative`} style={{ opacity }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes bounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.95); }
        }
        
        @keyframes wiggle {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(244, 114, 182, 0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(244, 114, 182, 0.6)); }
        }
        
        .creature-body {
          animation: float 4s ease-in-out infinite;
        }
        
        .creature-head {
          animation: bounce 2s ease-in-out infinite;
        }
        
        .creature-antenna {
          animation: wiggle 3s ease-in-out infinite;
          transform-origin: bottom center;
        }
        
        .creature-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
      
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full ${color} creature-glow`}
        fill="currentColor"
      >
        {/* Body - Main blob shape */}
        <g className="creature-body">
          {/* Lower body blob */}
          <ellipse cx="50" cy="65" rx="28" ry="25" fill="currentColor" opacity="0.9" />
          
          {/* Middle body */}
          <ellipse cx="50" cy="45" rx="30" ry="28" fill="currentColor" opacity="0.95" />
          
          {/* Upper body/chest */}
          <circle cx="50" cy="25" r="22" fill="currentColor" />
        </g>

        {/* Head/Face */}
        <g className="creature-head">
          {/* Head circle */}
          <circle cx="50" cy="12" r="16" fill="currentColor" />
          
          {/* Left eye */}
          <circle cx="43" cy="9" r="3.5" fill="white" opacity="0.9" />
          <circle cx="43" cy="9" r="2" fill="black" />
          
          {/* Right eye */}
          <circle cx="57" cy="9" r="3.5" fill="white" opacity="0.9" />
          <circle cx="57" cy="9" r="2" fill="black" />
          
          {/* Smile */}
          <path
            d="M 45 14 Q 50 16 55 14"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            opacity="0.8"
            strokeLinecap="round"
          />
        </g>

        {/* Left Antenna */}
        <g>
          <line
            x1="42"
            y1="0"
            x2="38"
            y2="-8"
            stroke="currentColor"
            strokeWidth="2"
            className="creature-antenna"
            opacity="0.8"
          />
          <circle cx="38" cy="-10" r="2.5" fill="currentColor" opacity="0.8" />
        </g>

        {/* Right Antenna */}
        <g>
          <line
            x1="58"
            y1="0"
            x2="62"
            y2="-8"
            stroke="currentColor"
            strokeWidth="2"
            className="creature-antenna"
            opacity="0.8"
            style={{ animationDelay: '0.3s' }}
          />
          <circle cx="62" cy="-10" r="2.5" fill="currentColor" opacity="0.8" />
        </g>

        {/* Left arm */}
        <g className="creature-body" style={{ animationDelay: '0.1s' }}>
          <ellipse cx="28" cy="40" rx="8" ry="14" fill="currentColor" opacity="0.85" />
          <circle cx="24" cy="52" r="4" fill="currentColor" opacity="0.8" />
        </g>

        {/* Right arm */}
        <g className="creature-body" style={{ animationDelay: '0.2s' }}>
          <ellipse cx="72" cy="40" rx="8" ry="14" fill="currentColor" opacity="0.85" />
          <circle cx="76" cy="52" r="4" fill="currentColor" opacity="0.8" />
        </g>

        {/* Left leg */}
        <g className="creature-body" style={{ animationDelay: '0.15s' }}>
          <ellipse cx="38" cy="85" rx="7" ry="12" fill="currentColor" opacity="0.85" />
          <ellipse cx="36" cy="96" rx="5" ry="3" fill="currentColor" opacity="0.8" />
        </g>

        {/* Right leg */}
        <g className="creature-body" style={{ animationDelay: '0.25s' }}>
          <ellipse cx="62" cy="85" rx="7" ry="12" fill="currentColor" opacity="0.85" />
          <ellipse cx="64" cy="96" rx="5" ry="3" fill="currentColor" opacity="0.8" />
        </g>

        {/* Belly spots for character */}
        <circle cx="48" cy="50" r="3" fill="white" opacity="0.4" />
        <circle cx="52" cy="55" r="2.5" fill="white" opacity="0.3" />
        <circle cx="46" cy="60" r="2" fill="white" opacity="0.25" />
      </svg>
    </div>
  );
};
