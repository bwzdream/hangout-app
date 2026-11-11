import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { ActivityCard, PingStories } from '@/components/cards';
import { PopButton, Sticker } from '@/components/playful';
import { AvatarStack, Button, Empty, IconButton, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
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

function dayPhrase(ms: number) {
  const d = formatDay(ms);
  return d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : `on ${d}`;
}

export default function Home() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const { width } = useWindowDimensions();
  const [nudged, setNudged] = useState(false);
  const [today] = useState(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

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
    const overlaps = mine ? groupOverlaps(findOverlaps(mine, theirs, range)) : [];
    const suggestion = mine ? suggestFreeTime(mine, range, 90, 1)[0] ?? null : null;
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const profiles = {
      ...(await getProfiles([...memberIds, ...pings.map((p) => p.sender_id)])),
      ...Object.fromEntries(friends.friends.map((f) => [f.id, f])),
    };
    if (profile) profiles[profile.id] = profile;
    return { friends, pings, viewed, activities, overlaps, suggestion, profiles };
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

  const best = data?.overlaps[0];
  const more = (data?.overlaps.length ?? 0) - 1;
  const firstName = (profile?.display_name || profile?.username || 'there').split(' ')[0];
  const cardWidth = Math.min(width, MaxContentWidth) - 40 - 36;

  const nudge = async () => {
    if (!best) return;
    try {
      await Promise.all(best.friendIds.map((id) => nudgeFriend(id, formatRange(best.start, best.end))));
      setNudged(true);
    } catch (e) {
      notify("Couldn't send nudge", errorMessage(e));
    }
  };

  const markFree = async () => {
    if (!data?.suggestion) return;
    try {
      await addFreeSlot(new Date(data.suggestion.start).toISOString(), new Date(data.suggestion.end).toISOString());
      reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: Spacing.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="caption">{today}</T>
          <IconButton icon="plus" label="New hangout" onPress={() => router.push('/activity/new')} />
        </Row>
        <T variant="display">
          Hey {firstName},{'\n'}free today?
        </T>
        <PopButton onPress={() => router.push('/ping/new')}>
          <Row style={{ padding: 22, justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flex: 1 }}>
              <T variant="largeTitle" color={Colors.onAccent}>
                I&apos;m free
              </T>
              <T variant="body" color={Colors.onAccent} style={{ opacity: 0.7 }}>
                Ping your friends. It disappears later.
              </T>
            </View>
            <Sticker icon="bolt" size={56} />
          </Row>
        </PopButton>
      </View>

      {data && data.pings.length > 0 ? (
        <Section title="Live now">
          <PingStories pings={data.pings} profiles={data.profiles} viewed={data.viewed} meId={meId} />
        </Section>
      ) : null}

      {data && data.friends.friends.length === 0 ? (
        <Empty
          icon="addPerson"
          title="Bring your people"
          body="Add a few friends to see when you're free at the same time."
          action={<Button title="Find friends" onPress={() => router.push('/friends')} />}
        />
      ) : null}

      {best && data ? (
        <Section title="Free together">
          <View style={{ backgroundColor: Colors.surface, borderRadius: 28, padding: 24, gap: Spacing.lg }}>
            <AvatarStack profiles={best.friendIds.map((id) => data.profiles[id])} size={44} />
            <View style={{ gap: 4 }}>
              <T variant="label" color={Colors.textSecondary}>
                You & {joinNames(best.friendIds.map((id) => displayName(data.profiles[id]).split(' ')[0]))}
              </T>
              <T variant="largeTitle">
                {formatDay(best.start)}, {formatTime(best.start)}
              </T>
              <T variant="body" color={Colors.textSecondary}>
                until {formatTime(best.end)}
              </T>
            </View>
            <Row gap={Spacing.md}>
              <Button
                title="Make plans"
                onPress={() =>
                  router.push({
                    pathname: '/activity/new',
                    params: {
                      start: String(best.start),
                      end: String(Math.min(best.end, best.start + 3 * 3600000)),
                      invite: best.friendIds.join(','),
                    },
                  })
                }
              />
              <Button title={nudged ? 'Nudged' : 'Nudge'} icon={nudged ? 'check' : 'hand'} variant="secondary" disabled={nudged} onPress={nudge} />
            </Row>
          </View>
          {more > 0 ? (
            <Pressable onPress={() => router.push('/calendar')} hitSlop={8}>
              <T variant="label" style={{ textDecorationLine: 'underline' }}>
                {more} more time{more === 1 ? '' : 's'} you&apos;re free together
              </T>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      <Section title="Coming up">
        {data && data.activities.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 14}
            decelerationRate="fast"
            style={{ marginHorizontal: -20, overflow: 'visible' }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 24 }}>
            {data.activities.map((a) => (
              <View key={a.id} style={{ width: data.activities.length === 1 ? cardWidth + 36 : cardWidth }}>
                <ActivityCard activity={a} profiles={data.profiles} meId={meId} height={280} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Empty
            icon="calendar"
            title="Nothing planned yet"
            body="Start something and let friends jump in."
            action={<Button title="New hangout" onPress={() => router.push('/activity/new')} />}
          />
        )}
      </Section>

      {data?.suggestion ? (
        <View style={{ gap: Spacing.md }}>
          <T variant="body" color={Colors.textSecondary}>
            Your calendar looks open {dayPhrase(data.suggestion.start)}, {formatTime(data.suggestion.start)}–
            {formatTime(data.suggestion.end)}.
          </T>
          <Button title="Mark me free" variant="secondary" size="sm" onPress={markFree} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
    </Screen>
  );
}
