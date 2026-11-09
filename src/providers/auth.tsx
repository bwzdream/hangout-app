import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getProfile } from '@/lib/api';
import { listenForNotificationTaps, registerForPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { deviceTimeZone } from '@/lib/time';
import type { Profile } from '@/lib/types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const p = await getProfile(userId).catch(() => null);
    // Keep the stored time zone in sync with the device (people travel!).
    const tz = deviceTimeZone();
    if (p && p.timezone !== tz) {
      await supabase.from('profiles').update({ timezone: tz }).eq('id', userId);
      p.timezone = tz;
    }
    setProfile(p);
  }, [userId]);

  useEffect(() => {
    // setProfile only runs after an await, so this doesn't cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfile();
    if (!userId) return;
    registerForPush(userId).catch((e) => console.warn('Push registration failed', e));
    return listenForNotificationTaps();
  }, [userId, refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  // Never expose a stale profile from a previous account.
  const currentProfile = profile && profile.id === userId ? profile : null;

  return (
    <AuthContext.Provider value={{ session, profile: currentProfile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
