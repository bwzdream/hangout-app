import '@/global.css';

import { Platform } from 'react-native';

/**
 * Pingle is dark-first: near-black canvas, graphite surfaces, Apple system greys
 * and a single bold accent (electric lime) for "free" and primary actions.
 */
export const Colors = {
  background: '#0A0A0B',
  surface: '#161618',
  surfaceRaised: '#1F1F22',
  surfacePressed: '#2A2A2E',
  hairline: 'rgba(255,255,255,0.08)',
  text: '#F5F5F7',
  textSecondary: '#8E8E93',
  textTertiary: '#5C5C61',
  accent: '#D4FF3F',
  accentDim: 'rgba(212,255,63,0.16)',
  onAccent: '#0A0A0B',
  white: '#F5F5F7',
  danger: '#FF453A',
  free: 'rgba(212,255,63,0.38)',
  busy: '#26262A',
} as const;

export type ThemeColors = typeof Colors;

export const Fonts = Platform.select({
  ios: { display: 'system-ui', body: 'system-ui' },
  web: { display: 'var(--font-display)', body: 'var(--font-display)' },
  default: { display: 'sans-serif', body: 'sans-serif' },
});

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const MaxContentWidth = 600;
