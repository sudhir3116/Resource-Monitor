import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
      aria-label="Toggle Theme"
    >
      {theme === 'light' ? (
        <div className="flex items-center gap-2">
          <Moon size={20} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Sun size={20} />
        </div>
      )}
    </motion.button>
  );
};

export default ThemeToggle;
