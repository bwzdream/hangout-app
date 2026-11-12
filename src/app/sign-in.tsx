import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { HandLogo } from '@/components/logo';
import { Button, Input, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { errorMessage, notify } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { deviceTimeZone } from '@/lib/time';

export default function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const signUp = mode === 'sign-up';

  const submit = async () => {
    if (!email || !password) return notify('Enter your email and password');
    setBusy(true);
    try {
      if (!signUp) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim(), username: username.trim().toLowerCase(), timezone: deviceTimeZone() },
          },
        });
        if (error) throw error;
        if (!data.session) notify('Check your inbox', 'We sent you a link to confirm your email.');
      }
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: Colors.background }}>
      <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: 72, gap: 40 }}>
        <View style={{ gap: Spacing.lg }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <HandLogo size={64} wave />
          </View>
          <T variant="display">
            pingle<T variant="display" color={Colors.accent}>.</T>
          </T>
          <T variant="title" color={Colors.textSecondary} style={{ fontWeight: '600' }}>
            See who&apos;s free.{'\n'}
            <T variant="title" style={{ fontWeight: '600' }}>
              Make the plan.
            </T>
          </T>
        </View>

        <View style={{ gap: Spacing.md }}>
          {signUp ? (
            <>
              <Input value={name} onChangeText={setName} placeholder="Name" autoComplete="name" />
              <Input
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
            onSubmitEditing={submit}
          />
          <Button title={signUp ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} size="lg" style={{ marginTop: Spacing.sm }} />
        </View>

        <Pressable onPress={() => setMode(signUp ? 'sign-in' : 'sign-up')} style={{ alignSelf: 'center' }}>
          <T variant="caption">
            {signUp ? 'Already have an account? ' : 'New here? '}
            <T variant="caption" color={Colors.text} style={{ fontWeight: '700' }}>
              {signUp ? 'Sign in' : 'Create an account'}
            </T>
          </T>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
