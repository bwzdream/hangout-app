import '@/global.css';

import { Platform } from 'react-native';

/**
 * Two colors on black, nothing else:
 *  - acid green: the brand, primary actions, "free"
 *  - neon pink: support — hangouts, live/unseen, destructive
 * Everything else is white text or grey.
 */
export const Colors = {
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
  onAccent: '#000000',
  pink: '#FF2D95', // neon pink
  pinkDim: 'rgba(255,45,149,0.16)',
  white: '#FFFFFF',
  danger: '#FF2D95',
  free: 'rgba(180,255,0,0.28)',
  busy: '#161618',
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
