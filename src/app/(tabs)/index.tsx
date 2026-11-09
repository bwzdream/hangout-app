import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ActivityCard, PingStories } from '@/components/cards';
import { AvatarStack, Bounce, Button, Card, Empty, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, notify } from '@/lib/alert';
import {
  addFreeSlot,
  getAvailability,
  getFriends,
  getProfiles,
  getViewedPingIds,
  listActivePings,
  listUpcomingActivities,
  nudgeFriend,
} from '@/lib/api';
import { groupOverlaps, findOverlaps, suggestFreeTime } from '@/lib/availability';
import { supabase } from '@/lib/supabase';
import { DAY_MS, formatRange } from '@/lib/time';
import { useAuth } from '@/providers/auth';

const GREETINGS = ['Who are we hanging with?', 'Free time = friend time ✨', 'Go touch grass (with friends) 🌱', "Let's make plans 🎈"];

export default function Home() {
  const theme = useTheme();
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  const { data, loading, refreshing, refresh, reload } = useData(async () => {
    if (!meId) return null;
    const range = { start: Date.now(), end: Date.now() + 7 * DAY_MS };
    const [friends, pings, viewed, activities] = await Promise.all([
      getFriends(),
      listActivePings(),
      getViewedPingIds(),
      listUpcomingActivities(),
    ]);
    const friendIds = friends.friends.map((f) => f.id);
    const availability = await getAvailability([meId, ...friendIds], range);
    const { [meId]: mine, ...theirs } = availability;
    const overlaps = mine ? groupOverlaps(findOverlaps(mine, theirs, range)).slice(0, 6) : [];
    const suggestions = mine ? suggestFreeTime(mine, range, 90, 3) : [];
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const pingSenders = pings.map((p) => p.sender_id);
    const profiles = {
      ...(await getProfiles([...memberIds, ...pingSenders])),
      ...Object.fromEntries(friends.friends.map((f) => [f.id, f])),
    };
    if (profile) profiles[profile.id] = profile;
    return { friends, pings, viewed, activities, overlaps, suggestions, profiles, hasRules: (mine?.rules.length ?? 0) > 0 };
  });

  // Live: refresh when a new ping or RSVP lands.
  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel('home-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_members' }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, reload]);

  if (loading && !data) return <Loading />;

  const nudge = async (friendIds: string[], label: string, key: string) => {
    try {
      await Promise.all(friendIds.map((id) => nudgeFriend(id, label)));
      setNudged((s) => new Set(s).add(key));
    } catch (e) {
      notify("Couldn't nudge", errorMessage(e));
    }
  };

  const markFree = async (start: number, end: number) => {
    try {
      await addFreeSlot(new Date(start).toISOString(), new Date(end).toISOString());
      reload();
    } catch (e) {
      notify('Oops', errorMessage(e));
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 4 }}>
        <T variant="title">Hey {profile?.display_name || 'there'} {profile?.avatar_emoji ?? '👋'}</T>
        <T variant="body" color={theme.textSecondary}>
          {greeting}
        </T>
      </View>

      <Bounce>
        <Button title="I'm free — ping my friends!" icon="🙌" size="lg" onPress={() => router.push('/ping/new')} />
      </Bounce>

      <PingStories pings={data?.pings ?? []} profiles={data?.profiles ?? {}} viewed={data?.viewed ?? new Set()} meId={meId} />

      {data && data.friends.friends.length === 0 ? (
        <Empty
          emoji="👯"
          title="Hanging out is better with friends"
          body="Add a few friends to see when you're both free."
          action={<Button title="Find friends" variant="accent" onPress={() => router.push('/friends')} />}
        />
      ) : null}

      {data && data.overlaps.length > 0 ? (
        <Section title="You're both free 👀">
          {data.overlaps.map((o) => {
            const key = `${o.start}-${o.friendIds.join(',')}`;
            const people = o.friendIds.map((id) => data.profiles[id]);
            const names = people.map((p) => displayName(p)).join(', ');
            const label = formatRange(o.start, o.end);
            return (
              <Card key={key} tone="successSoft">
                <Row style={{ justifyContent: 'space-between' }}>
                  <AvatarStack profiles={people} size={34} />
                  <Text style={{ fontSize: 22 }}>{o.friendIds.length > 1 ? '🎊' : '✨'}</Text>
                </Row>
                <T variant="heading">
                  You & {names}
                </T>
                <T variant="caption">{label}</T>
                <Row style={{ marginTop: Spacing.sm }}>
                  <Button
                    title={nudged.has(key) ? 'Nudged!' : 'Nudge'}
                    icon="👉"
                    size="sm"
                    variant="secondary"
                    disabled={nudged.has(key)}
                    onPress={() => nudge(o.friendIds, label, key)}
                  />
                  <Button
                    title="Plan it"
                    icon="📍"
                    size="sm"
                    variant="accent"
                    onPress={() =>
                      router.push({
                        pathname: '/activity/new',
                        params: { start: String(o.start), end: String(Math.min(o.end, o.start + 3 * 3600000)), invite: o.friendIds.join(',') },
                      })
                    }
                  />
                </Row>
              </Card>
            );
          })}
        </Section>
      ) : null}

      {data && data.suggestions.length > 0 ? (
        <Section
          title="Looks like you're free 🤔"
          action={<Button title="Set routine" variant="ghost" size="sm" onPress={() => router.push('/availability')} />}>
          <T variant="caption" style={{ marginTop: -6 }}>
            {data.hasRules
              ? 'Open spots in your calendar. Mark them free so friends can find you.'
              : "Your calendar's open here. Mark these free, or set a weekly routine."}
          </T>
          {data.suggestions.map((s) => (
            <Card key={s.start} tone="cardAlt">
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="label" style={{ flex: 1 }}>
                  {formatRange(s.start, s.end)}
                </T>
                <Button title="Mark free" size="sm" onPress={() => markFree(s.start, s.end)} />
              </Row>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section
        title="Upcoming hangouts"
        action={<Button title="+ Plan" variant="ghost" size="sm" onPress={() => router.push('/activity/new')} />}>
        {data && data.activities.length > 0 ? (
          data.activities.map((a) => <ActivityCard key={a.id} activity={a} profiles={data.profiles} meId={meId} />)
        ) : (
          <Empty emoji="🗓️" title="Nothing planned yet" body="Plan something and your friends can join in." />
        )}
      </Section>
    </Screen>
  );
}
