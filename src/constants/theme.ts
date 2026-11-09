import '@/global.css';

import { Platform } from 'react-native';

/** Pingle palette: warm, playful, high-contrast in both themes. */
export const Colors = {
  light: {
    text: '#1B1530',
    textSecondary: '#6B6880',
    background: '#FFF8F2',
    card: '#FFFFFF',
    cardAlt: '#F6EFFF',
    border: '#EDE6F2',
    primary: '#FF5A36',
    primaryText: '#FFFFFF',
    accent: '#7B5CFF',
    accentSoft: '#EDE7FF',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    warning: '#F59E0B',
    danger: '#E11D48',
    free: '#22C55E',
    busy: '#CBD5E1',
  },
  dark: {
    text: '#F8F5FF',
    textSecondary: '#A9A4BF',
    background: '#120F1F',
    card: '#1E1A2E',
    cardAlt: '#29223F',
    border: '#2E2844',
    primary: '#FF6B4A',
    primaryText: '#FFFFFF',
    accent: '#9B85FF',
    accentSoft: '#2C2550',
    success: '#4ADE80',
    successSoft: '#14361F',
    warning: '#FBBF24',
    danger: '#FB7185',
    free: '#4ADE80',
    busy: '#3B3654',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Fonts = Platform.select({
  ios: { rounded: 'ui-rounded', sans: 'system-ui' },
  web: { rounded: 'var(--font-rounded)', sans: 'var(--font-display)' },
  default: { rounded: 'normal', sans: 'normal' },
});

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const MaxContentWidth = 640;
