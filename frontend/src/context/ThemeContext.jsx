import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

// Export ThemeContext for compatibility
export { ThemeContext };

export const ThemeProvider = ({ children }) => {
  // Force dark mode exclusively
  const [theme] = useState('dark');

  // Apply theme to document element correctly
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
    root.classList.remove('light');
    localStorage.setItem('theme', 'dark');
  }, []);

  const toggleTheme = () => {
    console.warn('Theme toggle is disabled. Dark mode is enforced.');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
