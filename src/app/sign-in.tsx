import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Bounce, Button, Card, Input, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { deviceTimeZone } from '@/lib/time';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function SignIn() {
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return notify('Oops', 'Email and password, please 🙏');
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: name.trim(),
              username: username.trim().toLowerCase(),
              timezone: deviceTimeZone(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) notify('Check your inbox 📬', 'We sent you a link to confirm your email.');
      }
    } catch (e) {
      notify('Hmm', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: 48 }}>
        <View style={{ alignItems: 'center', gap: Spacing.sm }}>
          <Bounce>
            <Text style={{ fontSize: 72 }}>👋</Text>
          </Bounce>
          <T variant="hero" color={theme.primary}>
            pingle
          </T>
          <T variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
            See when your friends are free.{'\n'}Ping them. Go hang out.
          </T>
        </View>

        <Card style={{ gap: Spacing.lg }}>
          {mode === 'sign-up' ? (
            <>
              <Input label="Your name" value={name} onChangeText={setName} placeholder="Alex" />
              <Input
                label="Username"
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="alex_hangs"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
          />
          <Button
            title={mode === 'sign-in' ? 'Sign in' : "Let's go 🚀"}
            onPress={submit}
            loading={busy}
            size="lg"
          />
        </Card>

        <Button
          variant="ghost"
          title={mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
