import React from 'react';
import { motion } from 'framer-motion';

interface Tab3DItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconGradient: string;
  iconShadowColor: string;
}

interface Tab3DProps {
  tabs: Tab3DItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const Tab3D: React.FC<Tab3DProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="fixed bottom-6 left-4 right-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 rounded-[32px]">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 py-3 sm:py-5 flex flex-col items-center gap-2 transition-all duration-300 group relative"
            >
              {/* 3D Icon Container */}
              <div className="relative h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center">
                <motion.div
                  animate={{
                    y: isActive ? -8 : 0,
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`absolute inset-0 rounded-2xl ${tab.iconGradient} shadow-lg group-hover:shadow-xl transition-shadow duration-300 flex items-center justify-center`}
                  style={{
                    filter: isActive
                      ? `drop-shadow(0 8px 16px ${tab.iconShadowColor}80)`
                      : 'none',
                  }}
                >
                  {/* Icon */}
                  <div className="text-white scale-75">
                    {tab.icon}
                  </div>
                </motion.div>

                {/* Subtle inner shadow for depth */}
                <div
                  className={`absolute inset-0 rounded-2xl pointer-events-none ${tab.iconGradient} opacity-30`}
                  style={{
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.2)',
                  }}
                />
              </div>

              {/* Tab Label */}
              <motion.span
                animate={{
                  color: isActive
                    ? 'rgb(239, 68, 68)'
                    : 'rgb(107, 114, 128)',
                  fontWeight: isActive ? 700 : 500,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{ duration: 0.3 }}
                className="text-[10px] sm:text-xs font-medium"
              >
                {tab.label}
              </motion.span>

              {/* Active Indicator Line */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute bottom-1 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
