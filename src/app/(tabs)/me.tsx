import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Row, Screen, Section, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, notify } from '@/lib/alert';
import { getMyRules } from '@/lib/api';
import { canSyncDeviceCalendar, syncDeviceCalendar } from '@/lib/calendar';
import { WEEKDAYS, minutesToLabel } from '@/lib/time';
import { useAuth } from '@/providers/auth';

export default function Me() {
  const theme = useTheme();
  const { profile, session, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const { data: rules } = useData(getMyRules);

  const sync = async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const { blocks, calendars } = await syncDeviceCalendar(session.user.id);
      notify('Synced! 🎉', `Read ${calendars} calendar${calendars === 1 ? '' : 's'} and found ${blocks} busy block${blocks === 1 ? '' : 's'} in the next 4 weeks. Only the times are shared — never event names.`);
    } catch (e) {
      notify("Couldn't sync", errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl }}>
        <Avatar profile={profile} size={88} />
        <T variant="title">{profile?.display_name || 'You'}</T>
        <T variant="caption">@{profile?.username}</T>
        {profile?.bio ? <T style={{ textAlign: 'center' }}>{profile.bio}</T> : null}
        <Button title="Edit profile" size="sm" variant="secondary" onPress={() => router.push('/edit-profile')} />
      </Card>

      <Section
        title="My free time 🕒"
        action={<Button title="Edit" variant="ghost" size="sm" onPress={() => router.push('/availability')} />}>
        <Card onPress={() => router.push('/availability')}>
          {rules && rules.length > 0 ? (
            rules.map((r) => (
              <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                <T variant="label">{WEEKDAYS[r.weekday]}</T>
                <T variant="caption">
                  {minutesToLabel(r.start_minute)} – {minutesToLabel(r.end_minute)}
                </T>
              </Row>
            ))
          ) : (
            <T variant="caption">No weekly routine yet. Tap to set when you're usually free.</T>
          )}
        </Card>
      </Section>

      <Section title="Calendar sync 🔄">
        <Card style={{ gap: Spacing.md }}>
          <T variant="caption">
            We read when you're busy (Apple, Google, Outlook — anything on your phone) so friends only see your real free
            time. Event names never leave your device.
          </T>
          {canSyncDeviceCalendar ? (
            <Button title="Sync my calendars" icon="📆" onPress={sync} loading={syncing} />
          ) : (
            <View style={{ backgroundColor: theme.cardAlt, padding: Spacing.md, borderRadius: 12 }}>
              <T variant="caption">Calendar sync works in the iOS & Android app. Google Calendar on web is coming soon.</T>
            </View>
          )}
        </Card>
      </Section>

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}
