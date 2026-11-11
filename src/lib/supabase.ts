import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// The project URL and publishable key are public (they ship inside every app build),
// so they're safe to keep here as defaults. Override them with a .env file.
const DEFAULT_URL = 'https://hppuapgiyzxtutgvkxid.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Cmt7O12AI-aBmj0etETvXQ_DZ8anJyl';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: {
    // On web, supabase-js uses localStorage by default.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Only refresh the session while the app is in the foreground (native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
