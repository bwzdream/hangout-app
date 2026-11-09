import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Input, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorMessage, notify } from '@/lib/alert';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/providers/auth';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return notify('Username', '3–20 characters: lowercase letters, numbers or underscores.');
    }
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim(), username, bio: bio.trim() });
      await refreshProfile();
      router.back();
    } catch (e) {
      const msg = errorMessage(e);
      notify('Something went wrong', msg.includes('duplicate') ? 'That username is taken.' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ alignItems: 'center', paddingTop: Spacing.md }}>
        <Avatar profile={profile ? { ...profile, display_name: name } : null} size={88} />
      </View>
      <View style={{ gap: Spacing.lg }}>
        <Input label="Name" value={name} onChangeText={setName} autoComplete="name" />
        <Input
          label="Username"
          value={username}
          onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          autoCapitalize="none"
        />
        <Input label="Bio" value={bio} onChangeText={setBio} placeholder="A line about you" multiline maxLength={140} />
      </View>
      <T variant="caption">Interests are coming soon and will shape the hangouts you see.</T>
      <Button title="Save" onPress={save} loading={saving} size="lg" variant="white" />
    </Screen>
  );
}
