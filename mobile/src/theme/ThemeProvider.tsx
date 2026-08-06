import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { colors as lightColors } from './colors';

const darkColors = {
  primary: '#6D8BFF',
  primaryLight: '#2A3350',
  primaryDark: '#9BB1FF',
  accent: '#818CF8',
  accentLight: '#2B2B45',
  secondary: '#4ADE80',
  secondaryLight: '#1A3A2A',
  secondaryDark: '#4ADE80',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: {
    primary: '#F1F5F9',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    inverse: '#0F172A',
  },
  border: '#334155',
  borderLight: '#1E293B',
  success: '#4ADE80',
  successLight: '#1A3A2A',
  warning: '#FBBF24',
  warningLight: '#3A2A1A',
  error: '#F87171',
  errorLight: '#3A1A1A',
  info: '#9BB1FF',
  infoLight: '#1A2A3A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabInactive: '#64748B',
  skeleton: '#334155',
  gradient: {
    primary: ['#6D8BFF', '#4B6BED'],
    accent: ['#818CF8', '#6D8BFF'],
    secondary: ['#22C55E', '#16A34A'],
    card: ['#6D8BFF', '#4B6BED'],
    premium: ['#1E293B', '#0F172A'],
    soft: ['#2A3350', '#1E293B'],
  },
};

interface ColorScheme {
  readonly primary: string;
  readonly primaryLight: string;
  readonly primaryDark: string;
  readonly accent: string;
  readonly accentLight: string;
  readonly secondary: string;
  readonly secondaryLight: string;
  readonly secondaryDark: string;
  readonly background: string;
  readonly surface: string;
  readonly card: string;
  readonly text: { readonly primary: string; readonly secondary: string; readonly tertiary: string; readonly inverse: string };
  readonly border: string;
  readonly borderLight: string;
  readonly success: string;
  readonly successLight: string;
  readonly warning: string;
  readonly warningLight: string;
  readonly error: string;
  readonly errorLight: string;
  readonly info: string;
  readonly infoLight: string;
  readonly overlay: string;
  readonly tabInactive: string;
  readonly skeleton: string;
  readonly gradient: { readonly primary: readonly string[]; readonly accent: readonly string[]; readonly secondary: readonly string[]; readonly card: readonly string[]; readonly premium: readonly string[]; readonly soft: readonly string[] };
}

interface ThemeContextType {
  isDark: boolean;
  colors: ColorScheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors as unknown as ColorScheme,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    setIsDark(systemScheme === 'dark');
  }, [systemScheme]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const colors = (isDark ? darkColors : lightColors) as unknown as ColorScheme;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
