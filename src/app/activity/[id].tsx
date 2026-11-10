import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';

import { LiquidGradient, TiltCard, paletteFor } from '@/components/liquid';
import { Avatar, Badge, Button, Card, Empty, List, ListRow, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { deleteActivity, getActivity, getProfiles, setRsvp } from '@/lib/api';
import { addToCalendar } from '@/lib/calendar';
import { formatDay, formatTime } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const VISIBILITY_LABEL = { friends: 'All friends', circle: 'Circle', invite: 'Invite only' } as const;

function openMaps(location: string) {
  const q = encodeURIComponent(location);
  const url = Platform.select({
    ios: `https://maps.apple.com/?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  Linking.openURL(url);
}

export default function ActivityDetail() {
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
  if (!data) {
    return (
      <Screen edges={['bottom']}>
        <Empty icon="calendar" title="Hangout not available" body="It may have been cancelled or isn't shared with you." />
      </Screen>
    );
  }

  const { activity, profiles } = data;
  const isHost = activity.host_id === meId;
  const me = activity.members.find((m) => m.user_id === meId);
  const going = activity.members.filter((m) => m.status === 'going');
  const maybe = activity.members.filter((m) => m.status === 'maybe');
  const past = new Date(activity.ends_at).getTime() < now;
  const palette = paletteFor(activity.id);

  const rsvp = async (status: 'going' | 'maybe' | null) => {
    setBusy(true);
    try {
      await setRsvp(activity.id, status);
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const calendar = async () => {
    try {
      const msg = await addToCalendar({
        title: activity.title,
        startsAt: activity.starts_at,
        endsAt: activity.ends_at,
        location: activity.location,
        notes: activity.details,
      });
      notify(msg);
    } catch (e) {
      notify("Couldn't add to calendar", errorMessage(e));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: '' }} />

      <TiltCard height={300} glow={Colors.cardShadow}>
        <LiquidGradient palette={palette}>
          <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ backgroundColor: Colors.cardPill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <T variant="caption" color={Colors.cardPillInk} style={{ fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>
                  {new Date(activity.starts_at)
                    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    .toUpperCase()}
                </T>
              </View>
              <Text style={{ fontSize: 40 }}>{activity.emoji}</Text>
            </Row>
            <View style={{ gap: 6 }}>
              <T variant="display" color={Colors.cardInk} numberOfLines={2} style={{ fontSize: 46, lineHeight: 48 }}>
                {activity.title}
              </T>
              <T variant="label" color={Colors.cardInkSecondary}>
                Hosted by {isHost ? 'you' : displayName(profiles[activity.host_id])} · {VISIBILITY_LABEL[activity.visibility]}
              </T>
            </View>
          </View>
        </LiquidGradient>
      </TiltCard>

      <List>
        <ListRow
          icon="clock"
          title={`${formatDay(activity.starts_at)}, ${formatTime(activity.starts_at)}`}
          subtitle={`Until ${formatTime(activity.ends_at)}`}
          chevron={false}
        />
        {activity.location ? (
          <ListRow icon="pin" title={activity.location} subtitle="Open in Maps" onPress={() => openMaps(activity.location)} />
        ) : null}
        <ListRow icon="calendarAdd" title="Add to calendar" onPress={calendar} />
      </List>

      {activity.details ? (
        <Card>
          <T variant="overline">Details</T>
          <T variant="body" color={Colors.textSecondary}>
            {activity.details}
          </T>
        </Card>
      ) : null}

      {!past && !isHost ? (
        <Row>
          <Button
            title={me?.status === 'going' ? "You're going" : 'Going'}
            icon={me?.status === 'going' ? 'check' : undefined}
            variant={me?.status === 'going' ? 'primary' : 'white'}
            size="lg"
            onPress={() => rsvp(me?.status === 'going' ? null : 'going')}
            loading={busy}
            style={{ flex: 1 }}
          />
          <Button
            title="Maybe"
            variant="secondary"
            size="lg"
            onPress={() => rsvp(me?.status === 'maybe' ? null : 'maybe')}
            style={me?.status === 'maybe' ? { borderWidth: 1.5, borderColor: Colors.text } : undefined}
          />
        </Row>
      ) : null}

      <Section title={`Going · ${going.length}`}>
        <List>
          {going.map((m) => (
            <ListRow
              key={m.user_id}
              title={m.user_id === meId ? 'You' : displayName(profiles[m.user_id])}
              left={<Avatar profile={profiles[m.user_id]} size={32} />}
              right={m.user_id === activity.host_id ? <Badge label="Host" tone="pink" /> : undefined}
              chevron={false}
            />
          ))}
        </List>
      </Section>

      {maybe.length > 0 ? (
        <Section title={`Maybe · ${maybe.length}`}>
          <List>
            {maybe.map((m) => (
              <ListRow
                key={m.user_id}
                title={m.user_id === meId ? 'You' : displayName(profiles[m.user_id])}
                left={<Avatar profile={profiles[m.user_id]} size={32} />}
                chevron={false}
              />
            ))}
          </List>
        </Section>
      ) : null}

      <T variant="caption" color={Colors.textTertiary}>
        Shared photos, comments and bill splitting are coming soon.
      </T>

      {isHost ? (
        <Button
          title="Cancel hangout"
          variant="danger"
          onPress={async () => {
            if (await confirm('Cancel hangout?', 'It will be removed for everyone.', 'Cancel hangout')) {
              await deleteActivity(activity.id);
              router.back();
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
