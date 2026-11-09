import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';

import { Avatar, Button, Card, Empty, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { deleteActivity, getActivity, getProfiles, setRsvp } from '@/lib/api';
import { addToCalendar } from '@/lib/calendar';
import { formatRange } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const VISIBILITY_LABEL = { friends: '👯 All friends', circle: '✨ A circle', invite: '🔒 Invite only' } as const;

function openMaps(location: string) {
  const q = encodeURIComponent(location);
  const url = Platform.select({
    ios: `https://maps.apple.com/?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  Linking.openURL(url);
}

export default function ActivityDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const meId = session?.user.id;
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const { data, loading, reload } = useData(async () => {
    const activity = await getActivity(id);
    if (!activity) return null;
    const profiles = await getProfiles([activity.host_id, ...activity.members.map((m) => m.user_id)]);
    return { activity, profiles };
  });

  if (loading && !data) return <Loading />;
  if (!data) return <Empty emoji="🫥" title="This hangout isn't available" body="It may have been deleted or isn't shared with you." />;

  const { activity, profiles } = data;
  const isHost = activity.host_id === meId;
  const me = activity.members.find((m) => m.user_id === meId);
  const going = activity.members.filter((m) => m.status === 'going');
  const maybe = activity.members.filter((m) => m.status === 'maybe');
  const past = new Date(activity.ends_at).getTime() < now;

  const rsvp = async (status: 'going' | 'maybe' | null) => {
    setBusy(true);
    try {
      await setRsvp(activity.id, status);
      await reload();
    } catch (e) {
      notify('Oops', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const calendar = async () => {
    try {
      const msg = await addToCalendar({
        title: `${activity.emoji} ${activity.title}`,
        startsAt: activity.starts_at,
        endsAt: activity.ends_at,
        location: activity.location,
        notes: activity.details,
      });
      notify(msg);
    } catch (e) {
      notify("Couldn't add", errorMessage(e));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ alignItems: 'center', gap: Spacing.sm }}>
        <Text style={{ fontSize: 72 }}>{activity.emoji}</Text>
        <T variant="title" style={{ textAlign: 'center' }}>
          {activity.title}
        </T>
        <T variant="caption">
          hosted by {isHost ? 'you' : displayName(profiles[activity.host_id])} · {VISIBILITY_LABEL[activity.visibility]}
        </T>
      </View>

      <Card style={{ gap: Spacing.md }}>
        <Row gap={Spacing.md}>
          <Text style={{ fontSize: 22 }}>🕒</Text>
          <T variant="label" style={{ flex: 1 }}>
            {formatRange(activity.starts_at, activity.ends_at)}
          </T>
        </Row>
        {activity.location ? (
          <Row gap={Spacing.md}>
            <Text style={{ fontSize: 22 }}>📍</Text>
            <T variant="label" style={{ flex: 1 }}>
              {activity.location}
            </T>
            <Button title="Map" size="sm" variant="ghost" onPress={() => openMaps(activity.location)} />
          </Row>
        ) : null}
        {activity.details ? (
          <Row gap={Spacing.md} style={{ alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 22 }}>📝</Text>
            <T style={{ flex: 1 }}>{activity.details}</T>
          </Row>
        ) : null}
      </Card>

      {!past && !isHost ? (
        <Row>
          <Button
            title={me?.status === 'going' ? "You're going!" : "I'm in"}
            icon="🙌"
            variant={me?.status === 'going' ? 'accent' : 'primary'}
            onPress={() => rsvp(me?.status === 'going' ? null : 'going')}
            loading={busy}
            style={{ flex: 1 }}
          />
          <Button
            title="Maybe"
            icon="🤔"
            variant={me?.status === 'maybe' ? 'accent' : 'secondary'}
            onPress={() => rsvp(me?.status === 'maybe' ? null : 'maybe')}
          />
        </Row>
      ) : null}

      <Button title="Add to my calendar" icon="📅" variant="secondary" onPress={calendar} />

      <Section title={`Who's going (${going.length})`}>
        <Card style={{ gap: Spacing.md }}>
          {going.map((m) => (
            <Row key={m.user_id} gap={Spacing.md}>
              <Avatar profile={profiles[m.user_id]} size={36} />
              <T variant="label" style={{ flex: 1 }}>
                {m.user_id === meId ? 'You' : displayName(profiles[m.user_id])}
              </T>
              {m.user_id === activity.host_id ? <T variant="caption">host 👑</T> : null}
            </Row>
          ))}
          {maybe.length > 0 ? (
            <>
              <T variant="caption" color={theme.textSecondary}>
                Maybe
              </T>
              {maybe.map((m) => (
                <Row key={m.user_id} gap={Spacing.md}>
                  <Avatar profile={profiles[m.user_id]} size={30} />
                  <T variant="caption">{m.user_id === meId ? 'You' : displayName(profiles[m.user_id])}</T>
                </Row>
              ))}
            </>
          ) : null}
        </Card>
      </Section>

      <Card tone="cardAlt">
        <T variant="caption">📸 Shared album, comments & split-the-bill are coming in v2.</T>
      </Card>

      {isHost ? (
        <Button
          title="Cancel hangout"
          variant="danger"
          onPress={async () => {
            if (await confirm('Cancel hangout?', 'It will be removed for everyone.', 'Cancel it')) {
              await deleteActivity(activity.id);
              router.back();
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
