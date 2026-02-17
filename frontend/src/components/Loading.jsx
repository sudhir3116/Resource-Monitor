import React from 'react';
import { Zap } from 'lucide-react';

const Loading = ({ message = "Initializing Systems..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="relative flex items-center justify-center mb-8">
        {/* Pulsing Backlight */}
        <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-xl animate-pulse"></div>

        {/* Animated Icon Container */}
        <div className="relative bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl shadow-indigo-500/10 dark:shadow-none border border-slate-100 dark:border-white/5 animate-bounce-slow">
          <Zap
            size={48}
            className="text-indigo-600 dark:text-indigo-400 animate-pulse"
            strokeWidth={1.5}
            fill="currentColor"
            fillOpacity={0.1}
          />
        </div>

        {/* Orbiting Ring */}
        <div className="absolute border-2 border-indigo-500/30 border-t-indigo-600 rounded-full w-24 h-24 animate-spin"></div>
      </div>

      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-outfit uppercase">
          Eco<span className="text-indigo-600 dark:text-indigo-400">Grid</span>
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase animate-pulse">
          {message}
        </p>
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Loading;
