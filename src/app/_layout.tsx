import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SetupNeeded } from '@/components/setup-needed';
import { Colors } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.hairline,
  },
};

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  const signedIn = !!session;
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ping/new" options={{ presentation: 'modal', title: 'New ping' }} />
        <Stack.Screen name="ping/[id]" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="activity/new" options={{ presentation: 'modal', title: 'New hangout' }} />
        <Stack.Screen name="activity/[id]" options={{ title: '' }} />
        <Stack.Screen name="availability" options={{ title: 'Free time' }} />
        <Stack.Screen name="circles" options={{ title: 'Circles' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', title: 'Edit profile' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: Colors.background }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        {isSupabaseConfigured ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          <SetupNeeded />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
