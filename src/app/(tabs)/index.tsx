import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActivityCard, PingStories } from '@/components/cards';
import { Icon } from '@/components/icon';
import { AvatarStack, Button, Card, Empty, Header, IconButton, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
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
import { findOverlaps, groupOverlaps, suggestFreeTime } from '@/lib/availability';
import { supabase } from '@/lib/supabase';
import { DAY_MS, formatDay, formatRange, formatTime } from '@/lib/time';
import { useAuth } from '@/providers/auth';

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export default function Home() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  );

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
    const overlaps = mine ? groupOverlaps(findOverlaps(mine, theirs, range)).slice(0, 5) : [];
    const suggestions = mine ? suggestFreeTime(mine, range, 90, 3) : [];
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const profiles = {
      ...(await getProfiles([...memberIds, ...pings.map((p) => p.sender_id)])),
      ...Object.fromEntries(friends.friends.map((f) => [f.id, f])),
    };
    if (profile) profiles[profile.id] = profile;
    return { friends, pings, viewed, activities, overlaps, suggestions, profiles };
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
      notify("Couldn't send nudge", errorMessage(e));
    }
  };

  const markFree = async (start: number, end: number) => {
    try {
      await addFreeSlot(new Date(start).toISOString(), new Date(end).toISOString());
      reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  const firstName = (profile?.display_name || profile?.username || '').split(' ')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header
        overline={today}
        title={firstName ? `Hey, ${firstName}` : 'Hey there'}
        right={<IconButton icon="plus" label="New hangout" onPress={() => router.push('/activity/new')} />}
      />

      <Pressable
        onPress={() => router.push('/ping/new')}
        style={({ pressed }) => [
          {
            backgroundColor: Colors.accent,
            borderRadius: Radius.xl,
            padding: Spacing.xl,
            gap: Spacing.xs,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title" color={Colors.onAccent} style={{ fontWeight: '800' }}>
            I&apos;m free
          </T>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.onAccent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bolt" size={18} color={Colors.accent} />
          </View>
        </Row>
        <T variant="body" color="rgba(10,10,11,0.65)" style={{ fontWeight: '500' }}>
          Let your friends know. Disappears when you&apos;re not.
        </T>
      </Pressable>

      <Section title="Live now">
        <PingStories pings={data?.pings ?? []} profiles={data?.profiles ?? {}} viewed={data?.viewed ?? new Set()} meId={meId} />
      </Section>

      {data && data.friends.friends.length === 0 ? (
        <Empty
          icon="addPerson"
          title="Bring your people"
          body="Add friends to see when you're free at the same time."
          action={<Button title="Find friends" variant="white" size="sm" onPress={() => router.push('/friends')} />}
        />
      ) : null}

      {data && data.overlaps.length > 0 ? (
        <Section title="Free together">
          {data.overlaps.map((o) => {
            const key = `${o.start}-${o.friendIds.join(',')}`;
            const people = o.friendIds.map((id) => data.profiles[id]);
            const label = formatRange(o.start, o.end);
            return (
              <Card key={key}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ gap: 2 }}>
                    <T variant="overline" color={Colors.accent}>
                      {formatDay(o.start)}
                    </T>
                    <T variant="title">
                      {formatTime(o.start)} – {formatTime(o.end)}
                    </T>
                  </View>
                  <AvatarStack profiles={people} size={30} />
                </Row>
                <T variant="caption">You and {joinNames(people.map((p) => displayName(p)))} are both free.</T>
                <Row style={{ marginTop: Spacing.xs }}>
                  <Button
                    title="Make plans"
                    size="sm"
                    variant="white"
                    onPress={() =>
                      router.push({
                        pathname: '/activity/new',
                        params: {
                          start: String(o.start),
                          end: String(Math.min(o.end, o.start + 3 * 3600000)),
                          invite: o.friendIds.join(','),
                        },
                      })
                    }
                  />
                  <Button
                    title={nudged.has(key) ? 'Nudged' : 'Nudge'}
                    icon={nudged.has(key) ? 'check' : 'hand'}
                    size="sm"
                    variant="secondary"
                    disabled={nudged.has(key)}
                    onPress={() => nudge(o.friendIds, label, key)}
                  />
                </Row>
              </Card>
            );
          })}
        </Section>
      ) : null}

      <Section title="Coming up">
        {data && data.activities.length > 0 ? (
          data.activities.map((a) => <ActivityCard key={a.id} activity={a} profiles={data.profiles} meId={meId} />)
        ) : (
          <Empty
            icon="calendar"
            title="Nothing planned"
            body="Start something and let friends join in."
            action={<Button title="New hangout" size="sm" variant="white" onPress={() => router.push('/activity/new')} />}
          />
        )}
      </Section>

      {data && data.suggestions.length > 0 ? (
        <Section
          title="Open on your calendar"
          action={
            <Pressable onPress={() => router.push('/availability')} hitSlop={8}>
              <T variant="caption" color={Colors.text} style={{ fontWeight: '600' }}>
                Routine
              </T>
            </Pressable>
          }>
          <Card style={{ padding: 0, gap: 0 }}>
            {data.suggestions.map((s, i) => (
              <Row
                key={s.start}
                style={{
                  paddingHorizontal: Spacing.lg + 2,
                  paddingVertical: Spacing.md + 2,
                  justifyContent: 'space-between',
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: Colors.hairline,
                }}>
                <View>
                  <T variant="label">{formatDay(s.start)}</T>
                  <T variant="caption">
                    {formatTime(s.start)} – {formatTime(s.end)}
                  </T>
                </View>
                <Button title="Mark free" size="sm" variant="secondary" onPress={() => markFree(s.start, s.end)} />
              </Row>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
