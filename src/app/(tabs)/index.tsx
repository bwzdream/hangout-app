import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ActivityCard } from '@/components/cards';
import { FreeTimeline } from '@/components/free-timeline';
import { NearbyCard } from '@/components/nearby-card';
import { Button, Chip, Loading, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { getAvailability, getFriends, getMyRules, getProfiles, listActivePings, listUpcomingActivities } from '@/lib/api';
import { clip, freeWindows, intersect, merge, type Interval } from '@/lib/availability';
import { supabase } from '@/lib/supabase';
import { DAY_MS, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { dayStart } from '@/lib/when';
import { WELCOME_KEY } from '@/lib/onboarding';
import { getPublicStatus } from '@/lib/public';
import { useAuth } from '@/providers/auth';

const span = (w: Interval) => `${formatTime(w.start)} – ${formatTime(w.end)}`;

type Slot = { window: Interval; both: Interval | null; note: string | null };
type FriendToday = { profile: Profile; slots: Slot[]; best: Slot };

export default function Home() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [now] = useState(() => Date.now());
  const [which, setWhich] = useState<'today' | 'tomorrow'>('today');
  const checkedWelcome = useRef(false);

  const { data, loading, refreshing, refresh, reload } = useData(async () => {
    if (!meId) return null;
    const range = { start: dayStart(Date.now()), end: dayStart(Date.now()) + 2 * DAY_MS };
    const [friends, pings, activities, rules] = await Promise.all([getFriends(), listActivePings(), listUpcomingActivities(), getMyRules()]);
    const availability = await getAvailability([meId, ...friends.friends.map((f) => f.id)], range);
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const profiles = { ...(await getProfiles(memberIds)), ...Object.fromEntries(friends.friends.map((f) => [f.id, f])) };
    if (profile) profiles[profile.id] = profile;
    const publicOn = await getPublicStatus()
      .then((st) => st.enabled)
      .catch(() => false);
    return { friends: friends.friends, pings, activities, availability, profiles, hasRoutine: rules.length > 0, publicOn };
  });

  // First time here and nothing set up yet? Show the short welcome.
  useEffect(() => {
    if (!data || checkedWelcome.current) return;
    checkedWelcome.current = true;
    if (data.hasRoutine || data.friends.length > 0) return;
    AsyncStorage.getItem(WELCOME_KEY)
      .then((seen) => {
        if (!seen) router.push('/welcome');
      })
      .catch(() => {});
  }, [data]);

  // Live: refresh when a friend says they're free or someone RSVPs.
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

  const day = dayStart(now) + (which === 'tomorrow' ? DAY_MS : 0);
  const range = { start: which === 'today' ? Math.max(day, now) : day, end: day + DAY_MS };
  const dayWord = which === 'today' ? 'today' : 'tomorrow';

  const mine = data && meId && data.availability[meId] ? freeWindows(data.availability[meId], range) : [];
  const friendsFree: FriendToday[] = (data?.friends ?? [])
    .map((f) => {
      const ping = (data?.pings ?? []).find((p) => p.sender_id === f.id && new Date(p.starts_at).getTime() < range.end && new Date(p.ends_at).getTime() > range.start);
      const posted = ping ? clip([{ start: new Date(ping.starts_at).getTime(), end: new Date(ping.ends_at).getTime() }], range) : [];
      // Their usual/one-off free time, plus the time they just posted.
      const windows = merge([...(data?.availability[f.id] ? freeWindows(data.availability[f.id], range) : []), ...posted]);
      const slots: Slot[] = windows.map((w) => {
        // The longest stretch of this slot when you're free too.
        const both = intersect(mine, [w]).sort((x, y) => y.end - y.start - (x.end - x.start))[0] ?? null;
        const note = ping && posted.some((p) => p.start < w.end && p.end > w.start) ? ping.message || null : null;
        return { window: w, both, note };
      });
      const best = slots.find((s) => s.both) ?? slots[0];
      return { profile: f, slots, best };
    })
    .filter((f) => f.slots.length > 0)
    .sort((a, b) => Number(!!b.best.both) - Number(!!a.best.both) || a.best.window.start - b.best.window.start);

  const ask = (f: FriendToday, slot: Slot) => {
    const w = slot.both ?? slot.window;
    router.push({
      pathname: '/activity/new',
      params: { start: String(w.start), end: String(Math.min(w.end, w.start + 3 * 3600000)), invite: f.profile.id, title: slot.note ?? '' },
    });
  };

  const firstName = (profile?.display_name || profile?.username || '').split(' ')[0];
  const hasFriends = (data?.friends.length ?? 0) > 0;
  const nextPlan = data?.activities[0];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} center={false}>
      <View style={{ gap: 4 }}>
        <T variant="body" color={Colors.textSecondary}>
          {new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </T>
        <T variant="largeTitle">{firstName ? `Hi, ${firstName}` : 'Hi there'}</T>
      </View>

      <Row gap={10}>
        <Chip label="Today" selected={which === 'today'} onPress={() => setWhich('today')} />
        <Chip label="Tomorrow" selected={which === 'tomorrow'} onPress={() => setWhich('tomorrow')} />
      </Row>

      {/* 1. Me */}
      <Animated.View key={`me-${which}`} entering={FadeIn.duration(200)} style={{ gap: Spacing.md }}>
        {mine.length ? (
          <>
            <T variant="title">You&apos;re free {mine.map(span).join(', ')}</T>
            <Pressable onPress={() => router.push('/availability')} hitSlop={8}>
              <T variant="label" style={{ textDecorationLine: 'underline' }}>
                Change my free times
              </T>
            </Pressable>
          </>
        ) : (
          <>
            <T variant="title">Are you free {dayWord}?</T>
            <T variant="body" color={Colors.textSecondary}>
              Tap the green button at the bottom to tell your friends.
            </T>
          </>
        )}
      </Animated.View>

      {/* 2. Friends */}
      <Animated.View key={`friends-${which}`} entering={FadeIn.duration(200)} style={{ gap: Spacing.sm }}>
        <T variant="title">Who&apos;s free {dayWord}</T>
        {!hasFriends ? (
          <View style={{ gap: Spacing.md, paddingTop: Spacing.sm }}>
            <T variant="body" color={Colors.textSecondary}>
              Add friends to see when they&apos;re free.
            </T>
            <Button title="Find friends in my contacts" icon="friends" onPress={() => router.push('/find-friends')} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : friendsFree.length === 0 ? (
          <T variant="body" color={Colors.textSecondary} style={{ paddingTop: Spacing.sm }}>
            No one has said they&apos;re free {dayWord} yet. We&apos;ll show them here when they do.
          </T>
        ) : (
          <View style={{ gap: Spacing.lg, paddingTop: Spacing.sm }}>
            <T variant="body" color={Colors.textSecondary}>
              Tap a friend to ask them to hang out.
            </T>
            <FreeTimeline
              day={day}
              now={now}
              mine={mine}
              blocks={friendsFree.flatMap((f) =>
                f.slots.map((slot) => ({ key: `${f.profile.id}-${slot.window.start}`, profile: f.profile, window: slot.window, both: slot.both, note: slot.note })),
              )}
              onPress={(b) => {
                const f = friendsFree.find((x) => x.profile.id === b.profile.id)!;
                ask(f, f.slots.find((sl) => sl.window.start === b.window.start)!);
              }}
            />
          </View>
        )}
        {hasFriends ? (
          <Pressable onPress={() => router.navigate('/calendar')} hitSlop={8} style={{ paddingTop: Spacing.sm }}>
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              See the whole week
            </T>
          </Pressable>
        ) : null}
      </Animated.View>

      {/* 3. Meet people nearby */}
      {data ? <NearbyCard enabled={data.publicOn} /> : null}

      {/* 4. Next plan */}
      {nextPlan && data ? (
        <View style={{ gap: Spacing.md }}>
          <T variant="title">Your next hangout</T>
          <ActivityCard activity={nextPlan} profiles={data.profiles} meId={meId} height={220} />
        </View>
      ) : null}
    </Screen>
  );
}
