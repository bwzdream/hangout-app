import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { Card, Header, Screen, T } from './ui';

/** Shown when the Supabase environment variables are missing. */
export function SetupNeeded() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <Screen>
      <Header overline="Setup" title="Connect Supabase" />
      <Card>
        <T>Copy .env.example to .env and fill in:</T>
        <T variant="label">EXPO_PUBLIC_SUPABASE_URL{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY</T>
        <T variant="caption">Then restart the dev server. See README.md for details.</T>
      </Card>
    </Screen>
  );
}
