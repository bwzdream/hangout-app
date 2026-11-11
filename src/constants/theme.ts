import '@/global.css';

import { Platform } from 'react-native';

/**
 * Two themes, chosen at build time with EXPO_PUBLIC_THEME=light|dark (default: light).
 *
 *  light ("Paper"): warm off-white, black text and CTAs, bright mint highlights, serif headlines
 *  dark  ("Night"): black, acid green primary, neon pink support
 */
export const THEME: 'light' | 'dark' = process.env.EXPO_PUBLIC_THEME === 'dark' ? 'dark' : 'light';
export const isLight = THEME === 'light';

const dark = {
  background: '#000000',
  surface: '#0E0E10',
  surfaceRaised: '#18181B',
  surfacePressed: '#222226',
  hairline: 'rgba(255,255,255,0.10)',
  outline: 'rgba(255,255,255,0.22)',
  text: '#FFFFFF',
  textSecondary: '#8A8A90',
  textTertiary: '#55555B',
  accent: '#B4FF00', // acid green
  accentDim: 'rgba(180,255,0,0.14)',
  accentInk: '#B4FF00', // accent used as text
  onAccent: '#000000',
  pink: '#FF2D95', // neon pink support
  pinkDim: 'rgba(255,45,149,0.16)',
  onPink: '#FFFFFF',
  white: '#FFFFFF',
  danger: '#FF2D95',
  free: 'rgba(180,255,0,0.28)',
  busy: '#161618',
  // Primary CTA
  cta: '#B4FF00',
  onCta: '#000000',
  // Text and pills on top of hangout gradients
  cardInk: '#FFFFFF',
  cardInkSecondary: 'rgba(255,255,255,0.8)',
  cardPill: '#000000',
  cardPillInk: '#FFFFFF',
  cardShadow: 'rgba(180,255,0,0.55)',
  scrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)'] as [string, string, string],
  sheen: 'rgba(255,255,255,0.5)',
  palettes: [
    ['#B4FF00', '#FF2D95', '#000000'],
    ['#FF2D95', '#B4FF00', '#000000'],
    ['#B4FF00', '#0A3A00', '#000000'],
    ['#FF2D95', '#4A0026', '#000000'],
  ] as [string, string, string][],
};

const light: typeof dark = {
  background: '#EEEBE5', // warm off-white
  surface: '#F7F4EE', // cream sheet
  surfaceRaised: '#E3DFD7',
  surfacePressed: '#DAD5CC',
  hairline: 'rgba(17,17,17,0.10)',
  outline: 'rgba(17,17,17,0.22)',
  text: '#141414',
  textSecondary: '#6E6B66',
  textTertiary: '#A19D96',
  accent: '#9DF5AE', // bright mint
  accentDim: 'rgba(110,231,140,0.28)',
  accentInk: '#1E7A45', // mint is too light for text; use a deep green
  onAccent: '#141414',
  pink: '#141414', // support role is plain ink in this theme
  pinkDim: 'rgba(20,20,20,0.07)',
  onPink: '#F7F4EE',
  white: '#FFFFFF',
  danger: '#B3261E',
  free: 'rgba(110,231,140,0.45)',
  busy: '#E3DFD7',
  cta: '#141414',
  onCta: '#F7F4EE',
  cardInk: '#141414',
  cardInkSecondary: 'rgba(20,20,20,0.62)',
  cardPill: '#141414',
  cardPillInk: '#F7F4EE',
  cardShadow: 'rgba(20,20,20,0.18)',
  scrim: ['rgba(247,244,238,0)', 'rgba(247,244,238,0.25)', 'rgba(247,244,238,0.85)'],
  sheen: 'rgba(255,255,255,0.65)',
  palettes: [
    ['#9DF5AE', '#F3EFC9', '#EAE6DE'],
    ['#7EE8C0', '#DDF7D2', '#EFEBE3'],
    ['#B8F7A0', '#9DF5AE', '#E8E3D9'],
    ['#9DF5AE', '#CFE9F2', '#F0ECE4'],
  ],
};

export const Colors = isLight ? light : dark;
export type ThemeColors = typeof dark;

const serif = isLight ? 'InstrumentSerif_400Regular' : undefined;

export const Fonts = {
  // Headlines: an editorial serif in the light theme, heavy system sans in the dark theme
  display: serif ?? Platform.select({ ios: 'system-ui', web: 'var(--font-display)', default: 'sans-serif' }),
  body: Platform.select({ ios: 'system-ui', web: 'var(--font-display)', default: 'sans-serif' }),
  serif: !!serif,
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999, button: 999 } as const;
export const MaxContentWidth = 600;
