import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check local storage or default to dark (as requested)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('hr_theme');
    return saved ? saved === 'dark' : true; // Default to dark if no preference saved
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('hr_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('hr_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
