import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { Spacing } from '@/constants/theme';

import { Card, Screen, T } from './ui';

/** Shown when the Supabase environment variables are missing. */
export function SetupNeeded() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <Screen>
      <T variant="hero">🔌 Almost there</T>
      <Card style={{ gap: Spacing.md }}>
        <T>Pingle needs a Supabase project. Copy `.env.example` to `.env` and fill in:</T>
        <T variant="label">EXPO_PUBLIC_SUPABASE_URL{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY</T>
        <T variant="caption">Then restart `npx expo start`. See README.md for the full setup.</T>
      </Card>
    </Screen>
  );
}
