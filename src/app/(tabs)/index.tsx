import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { DayTimeline, type TimelinePerson } from '@/components/calendar-views';
import { ActivityCard } from '@/components/cards';
import { Button, Chip, Empty, IconButton, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { errorMessage, notify } from '@/lib/alert';
import {
  getAvailability,
  getFriends,
  getProfiles,
  listActivePings,
  listUpcomingActivities,
  nudgeFriend,
} from '@/lib/api';
import { freeWindows, intersect } from '@/lib/availability';
import { supabase } from '@/lib/supabase';
import { DAY_MS, formatRange, formatTime } from '@/lib/time';
import { dayStart } from '@/lib/when';
import { useAuth } from '@/providers/auth';

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export default function Home() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const { width } = useWindowDimensions();
  const [now] = useState(() => Date.now());
  const [which, setWhich] = useState<'today' | 'tomorrow'>('today');
  const [nudged, setNudged] = useState(false);
  const sentToFriends = useRef(false);

  const { data, loading, refreshing, refresh, reload } = useData(async () => {
    if (!meId) return null;
    const range = { start: dayStart(Date.now()), end: dayStart(Date.now()) + 2 * DAY_MS };
    const [friends, pings, activities] = await Promise.all([getFriends(), listActivePings(), listUpcomingActivities()]);
    const availability = await getAvailability([meId, ...friends.friends.map((f) => f.id)], range);
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const profiles = {
      ...(await getProfiles([...memberIds, ...pings.map((p) => p.sender_id)])),
      ...Object.fromEntries(friends.friends.map((f) => [f.id, f])),
    };
    if (profile) profiles[profile.id] = profile;
    return { friends: friends.friends, pings, activities, availability, profiles };
  });

  // No friends yet? Take them to the Friends page (once per visit).
  useEffect(() => {
    if (data && data.friends.length === 0 && !sentToFriends.current) {
      sentToFriends.current = true;
      router.navigate('/friends');
    }
  }, [data]);

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

  // ── Who's free on the selected day ──
  const day = dayStart(now) + (which === 'tomorrow' ? DAY_MS : 0);
  const visibleFrom = which === 'today' ? Math.max(day, now - 30 * 60000) : day;
  const range = { start: visibleFrom, end: day + DAY_MS };
  const startHour = which === 'today' ? Math.max(7, Math.min(new Date(now).getHours(), 20)) : 8;

  const pingsFor = (userId: string) =>
    (data?.pings ?? [])
      .filter((p) => p.sender_id === userId && new Date(p.ends_at).getTime() > range.start && new Date(p.starts_at).getTime() < range.end)
      .map((p) => ({ id: p.id, start: new Date(p.starts_at).getTime(), end: new Date(p.ends_at).getTime(), message: p.message }));

  const mine = data && meId && data.availability[meId] ? freeWindows(data.availability[meId], range) : [];
  const friendRows: TimelinePerson[] = (data?.friends ?? [])
    .map((f) => {
      const windows = data?.availability[f.id] ? freeWindows(data.availability[f.id], range) : [];
      return { profile: f, label: displayName(f).split(' ')[0], windows, overlap: intersect(mine, windows), pings: pingsFor(f.id) };
    })
    .filter((r) => r.windows.length > 0 || (r.pings?.length ?? 0) > 0)
    .sort((a, b) => (b.pings?.length ?? 0) - (a.pings?.length ?? 0) || b.overlap.length - a.overlap.length);
  const busyFriends = (data?.friends.length ?? 0) - friendRows.length;
  const people: TimelinePerson[] = [{ profile, label: 'You', windows: mine, overlap: [], pings: meId ? pingsFor(meId) : [] }, ...friendRows];

  // The best overlap on that day, for the one-line suggestion.
  const best = friendRows
    .flatMap((r) => r.overlap.filter((o) => o.end - o.start >= 3600000).map((o) => ({ ...o, profile: r.profile! })))
    .sort((a, b) => a.start - b.start)[0];
  const bestWith = best ? friendRows.filter((r) => r.overlap.some((o) => o.start < best.end && o.end > best.start)).map((r) => r.profile!) : [];

  const firstName = (profile?.display_name || profile?.username || 'there').split(' ')[0];
  const cardWidth = Math.min(width, MaxContentWidth) - 40 - 36;

  const nudge = async () => {
    if (!best) return;
    try {
      await Promise.all(bestWith.map((p) => nudgeFriend(p.id, formatRange(best.start, best.end))));
      setNudged(true);
    } catch (e) {
      notify("Couldn't send nudge", errorMessage(e));
    }
  };

  const planWith = (ids: string[], start: number, end: number) =>
    router.push({
      pathname: '/activity/new',
      params: { start: String(start), end: String(Math.min(end, start + 3 * 3600000)), invite: ids.join(',') },
    });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} center={false}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 2 }}>
          <T variant="caption">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
          <T variant="largeTitle">Hey, {firstName}</T>
        </View>
        <IconButton icon="plus" label="New hangout" onPress={() => router.push('/activity/new')} />
      </Row>

      <View style={{ gap: Spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title">Who&apos;s free</T>
          <Row gap={8}>
            <Chip label="Today" selected={which === 'today'} onPress={() => setWhich('today')} />
            <Chip label="Tomorrow" selected={which === 'tomorrow'} onPress={() => setWhich('tomorrow')} />
          </Row>
        </Row>

        <DayTimeline
          day={day}
          people={people}
          now={now}
          startHour={startHour}
          endHour={24}
          hourHeight={38}
          onPressPing={(id) => router.push({ pathname: '/ping/[id]', params: { id } })}
          onPressFree={(p, w) => (p.profile?.id === meId ? router.push('/availability') : planWith([p.profile!.id], w.start, w.end))}
        />

        <Row gap={Spacing.lg} style={{ flexWrap: 'wrap' }}>
          <Row gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.free }} />
            <T variant="caption">Free</T>
          </Row>
          <Row gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.accent }} />
            <T variant="caption">Free with you</T>
          </Row>
          <Row gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: Colors.text }} />
            <T variant="caption">Pinged</T>
          </Row>
        </Row>
        <T variant="caption">
          Tap someone&apos;s time to make plans with them.
          {busyFriends > 0 ? ` ${busyFriends} friend${busyFriends === 1 ? ' hasn’t' : 's haven’t'} shared free time yet.` : ''}
        </T>
      </View>

      {best ? (
        <View style={{ gap: Spacing.lg }}>
          <T variant="title">
            You & {joinNames(bestWith.map((p) => displayName(p).split(' ')[0]))} are free {formatTime(best.start)}–{formatTime(best.end)}
          </T>
          <Row gap={Spacing.md}>
            <Button title="Make plans" onPress={() => planWith(bestWith.map((p) => p.id), best.start, best.end)} />
            <Button title={nudged ? 'Nudged' : 'Nudge'} icon={nudged ? 'check' : 'hand'} variant="secondary" disabled={nudged} onPress={nudge} />
          </Row>
        </View>
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
                <ActivityCard activity={a} profiles={data.profiles} meId={meId} height={260} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Empty
            icon="calendar"
            title="Nothing planned yet"
            body="Tap someone's free time above, or start a hangout."
            action={<Button title="New hangout" onPress={() => router.push('/activity/new')} />}
          />
        )}
      </Section>
    </Screen>
  );
}
