import { InstrumentSerif_400Regular, useFonts } from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SetupNeeded } from '@/components/setup-needed';
import { Colors, isLight } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...(isLight ? DefaultTheme : DarkTheme),
  dark: !isLight,
  colors: {
    ...(isLight ? DefaultTheme : DarkTheme).colors,
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
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="ping/new" options={{ presentation: 'modal', title: "I'm free" }} />
        <Stack.Screen name="ping/[id]" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="activity/new" options={{ presentation: 'modal', title: 'Plan a hangout' }} />
        <Stack.Screen name="activity/[id]" options={{ title: '' }} />
        <Stack.Screen name="availability" options={{ title: 'My free times' }} />
        <Stack.Screen name="circles" options={{ title: 'Groups' }} />
        <Stack.Screen name="find-friends" options={{ title: 'Find friends' }} />
        <Stack.Screen name="public" options={{ title: 'Nearby' }} />
        <Stack.Screen name="plus" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', title: 'Edit profile' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ InstrumentSerif_400Regular });
  if (!fontsLoaded && !fontError) return null; // splash screen stays up

  return (
    <SafeAreaProvider style={{ backgroundColor: Colors.background }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={isLight ? 'dark' : 'light'} />
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
