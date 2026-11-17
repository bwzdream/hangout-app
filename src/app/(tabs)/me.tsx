import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Bouncy } from '@/components/playful';
import { Avatar, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import { getMyRules } from '@/lib/api';
import { canSyncDeviceCalendar, syncDeviceCalendar } from '@/lib/calendar';
import { useAuth } from '@/providers/auth';

function Tile({
  icon,
  title,
  body,
  onPress,
  tone = 'cream',
  busy,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress?: () => void;
  tone?: 'cream' | 'mint';
  busy?: boolean;
}) {
  const mint = tone === 'mint';
  return (
    <Bouncy
      onPress={onPress}
      disabled={!onPress}
      style={{
        flex: 1,
        minHeight: 170,
        borderRadius: 28,
        padding: 20,
        justifyContent: 'space-between',
        backgroundColor: mint ? Colors.accent : Colors.surface,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: mint ? Colors.text : Colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {busy ? <ActivityIndicator color={mint ? Colors.accent : Colors.text} /> : <Icon name={icon} size={20} color={mint ? Colors.accent : Colors.text} />}
      </View>
      <View style={{ gap: 4 }}>
        <T variant="title" color={mint ? Colors.onAccent : Colors.text} style={{ fontSize: 24, lineHeight: 28 }}>
          {title}
        </T>
        <T variant="caption" color={mint ? Colors.onAccent : Colors.textSecondary} numberOfLines={4} style={mint ? { opacity: 0.7 } : undefined}>
          {body}
        </T>
      </View>
    </Bouncy>
  );
}

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
    rules && rules.length > 0 ? 'Your usual free times are set. Tap to see or change them.' : 'Tap to tell friends when you’re usually free.'

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xl }}>
        <Avatar profile={profile} size={116} />
        <View style={{ alignItems: 'center', gap: 2, marginTop: Spacing.sm }}>
          <T variant="largeTitle">{profile?.display_name || 'You'}</T>
          <T variant="body" color={Colors.textSecondary}>
            @{profile?.username}
          </T>
        </View>
        {profile?.bio ? (
          <T variant="body" style={{ textAlign: 'center', maxWidth: 300 }}>
            {profile.bio}
          </T>
        ) : null}
      </View>

      <Row gap={Spacing.md} style={{ alignItems: 'stretch' }}>
        <Tile icon="clock" tone="mint" title="My free times" body={routine} onPress={() => router.push('/availability')} />
        <Tile
          icon="sync"
          title="My calendar"
          body={canSyncDeviceCalendar ? 'Tap to connect, so friends don’t see you as free when you’re busy.' : 'Open Pingle on your phone to connect your calendar.'}
          onPress={canSyncDeviceCalendar ? sync : undefined}
          busy={syncing}
        />
      </Row>

      <Row style={{ justifyContent: 'center', gap: Spacing.xl }}>
        <Pressable onPress={() => router.push('/edit-profile')} hitSlop={8}>
          <T variant="label" style={{ textDecorationLine: 'underline' }}>
            Edit profile
          </T>
        </Pressable>
        <Pressable onPress={() => router.push('/circles')} hitSlop={8}>
          <T variant="label" style={{ textDecorationLine: 'underline' }}>
            Groups
          </T>
        </Pressable>
        <Pressable onPress={signOut} hitSlop={8}>
          <T variant="label" color={Colors.danger} style={{ textDecorationLine: 'underline' }}>
            Sign out
          </T>
        </Pressable>
      </Row>
    </Screen>
  );
}
