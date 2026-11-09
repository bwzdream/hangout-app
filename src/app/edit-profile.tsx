import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Button, Input, Screen, T } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, notify } from '@/lib/alert';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/providers/auth';

const AVATARS = ['😎', '🥳', '🤠', '🦄', '🐸', '🐼', '🦊', '🐙', '🌈', '🍉', '🔥', '👾', '🌻', '🐶', '🐱', '🧸'];

export default function EditProfile() {
  const theme = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [emoji, setEmoji] = useState(profile?.avatar_emoji ?? '😎');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return notify('Username', '3–20 characters: lowercase letters, numbers or _');
    }
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim(), username, bio: bio.trim(), avatar_emoji: emoji });
      await refreshProfile();
      router.back();
    } catch (e) {
      const msg = errorMessage(e);
      notify('Oops', msg.includes('duplicate') ? 'That username is taken 😬' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ alignItems: 'center' }}>
        <Avatar profile={profile ? { ...profile, avatar_emoji: emoji } : null} size={96} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {AVATARS.map((a) => (
          <Pressable
            key={a}
            onPress={() => setEmoji(a)}
            style={{
              width: 48,
              height: 48,
              borderRadius: Radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: a === emoji ? theme.accent : theme.border,
              backgroundColor: theme.card,
            }}>
            <Text style={{ fontSize: 26 }}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input
        label="Username"
        value={username}
        onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
        autoCapitalize="none"
      />
      <Input label="Bio" value={bio} onChangeText={setBio} placeholder="Always down for tacos 🌮" multiline maxLength={140} />
      <T variant="caption">Interests & identity are coming in v2 — they'll shape the activities you see.</T>
      <Button title="Save" onPress={save} loading={saving} size="lg" />
    </Screen>
  );
}
