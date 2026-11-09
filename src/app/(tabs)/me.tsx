import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Avatar, List, ListRow, Screen, Section, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { getMyRules } from '@/lib/api';
import { canSyncDeviceCalendar, syncDeviceCalendar } from '@/lib/calendar';
import { WEEKDAYS, minutesToLabel } from '@/lib/time';
import { useAuth } from '@/providers/auth';

export default function Me() {
  const { profile, session, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const { data: rules } = useData(getMyRules);

  const sync = async () => {
    if (!session) return;
    setSyncing(true);
    try {
      const { blocks, calendars } = await syncDeviceCalendar(session.user.id);
      notify(
        'Calendars synced',
        `${calendars} calendar${calendars === 1 ? '' : 's'}, ${blocks} busy block${blocks === 1 ? '' : 's'} over the next 4 weeks. Only times are shared, never event names.`,
      );
    } catch (e) {
      notify("Couldn't sync", errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const routine =
    rules && rules.length > 0
      ? [...new Set(rules.map((r) => WEEKDAYS[r.weekday]))].join(', ') +
        ` · from ${minutesToLabel(Math.min(...rules.map((r) => r.start_minute)))}`
      : 'Not set';

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.lg }}>
        <Avatar profile={profile} size={96} />
        <T variant="title" style={{ marginTop: Spacing.sm }}>
          {profile?.display_name || 'You'}
        </T>
        <T variant="caption">@{profile?.username}</T>
        {profile?.bio ? (
          <T variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
            {profile.bio}
          </T>
        ) : null}
      </View>

      <Section title="Availability">
        <List>
          <ListRow icon="clock" title="Weekly free time" subtitle={routine} onPress={() => router.push('/availability')} />
          <ListRow
            icon="sync"
            title="Sync calendars"
            subtitle={
              canSyncDeviceCalendar
                ? 'Apple, Google, Outlook — busy times only'
                : 'Available in the iOS and Android app'
            }
            onPress={canSyncDeviceCalendar ? sync : undefined}
            right={syncing ? <ActivityIndicator color={Colors.textSecondary} /> : undefined}
          />
        </List>
      </Section>

      <Section title="Account">
        <List>
          <ListRow icon="edit" title="Edit profile" onPress={() => router.push('/edit-profile')} />
          <ListRow icon="circles" title="Circles" onPress={() => router.push('/circles')} />
          <ListRow icon="logout" title="Sign out" destructive onPress={signOut} chevron={false} />
        </List>
      </Section>
    </Screen>
  );
}
