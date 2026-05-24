import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

type Palette = {
  primary: string;
  primaryPressed: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
};

const light: Palette = {
  primary: '#E8711A',
  primaryPressed: '#C45D0E',
  primaryFg: '#FFFFFF',
  accent: '#EB1700',
  accentFg: '#FFFFFF',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F7F7',
  border: '#E6E6E6',
  text: '#1F1F1F',
  textMuted: '#6B6B6B',
  textInverse: '#FFFFFF',
  success: '#2EB872',
  warning: '#F5A623',
  danger: '#EB1700',
  overlay: 'rgba(0,0,0,0.45)',
};

const dark: Palette = {
  primary: '#FF8534',
  primaryPressed: '#E8711A',
  primaryFg: '#1A0E05',
  accent: '#FF3B1E',
  accentFg: '#FFFFFF',
  bg: '#0E0E10',
  surface: '#17171A',
  surfaceAlt: '#1F1F23',
  border: '#2A2A2F',
  text: '#F5F5F5',
  textMuted: '#9A9A9F',
  textInverse: '#0E0E10',
  success: '#3DD58A',
  warning: '#FFB23F',
  danger: '#FF4530',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
  cta: 28,
};

export const type = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  cta: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
};

export const tapTarget = { min: 48 };

type Theme = {
  c: Palette;
  isDark: boolean;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  tapTarget: typeof tapTarget;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const value = useMemo<Theme>(
    () => ({
      c: isDark ? dark : light,
      isDark,
      spacing,
      radius,
      type,
      tapTarget,
    }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
