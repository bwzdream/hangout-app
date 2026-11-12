import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DayTimeline, MonthCalendar, WeekStrip, localDayStart, type DayMark, type TimelinePerson } from '@/components/calendar-views';
import { Icon } from '@/components/icon';
import { ActivityCard } from '@/components/cards';
import { Button, Card, IconButton, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { getAvailability, getFriends, getProfiles, listActivitiesBetween } from '@/lib/api';
import { freeWindows, intersect } from '@/lib/availability';
import { DAY_MS } from '@/lib/time';
import { useAuth } from '@/providers/auth';

function gridRange(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()).getTime();
  return { start, end: start + 42 * DAY_MS };
}

export default function CalendarTab() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [now] = useState(() => Date.now());
  const [month, setMonth] = useState(() => new Date(now));
  const [selected, setSelected] = useState(() => localDayStart(now));
  const [expanded, setExpanded] = useState(false);

  const { data, loading, refreshing, refresh, reload } = useData(async () => {
    if (!meId) return null;
    const range = gridRange(month);
    const [friends, activities] = await Promise.all([getFriends(), listActivitiesBetween(range.start, range.end)]);
    const availability = await getAvailability([meId, ...friends.friends.map((f) => f.id)], range);
    const memberIds = activities.flatMap((a) => [a.host_id, ...a.members.map((m) => m.user_id)]);
    const profiles = { ...(await getProfiles(memberIds)), ...Object.fromEntries(friends.friends.map((f) => [f.id, f])) };
    if (profile) profiles[profile.id] = profile;
    return { friends: friends.friends, availability, activities, profiles, monthKey: `${month.getFullYear()}-${month.getMonth()}` };
  });

  // Fetch again when switching months.
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  useEffect(() => {
    if (data && data.monthKey !== monthKey) reload();
  }, [monthKey, data, reload]);

  // Per-day marks for the month grid.
  const marks = useMemo(() => {
    const out: Record<number, DayMark> = {};
    if (!data || !meId) return out;
    const range = gridRange(month);
    const me = data.availability[meId];
    for (let day = range.start; day < range.end; day = localDayStart(day + DAY_MS + 3600000)) {
      const dayRange = { start: Math.max(day, now), end: day + DAY_MS };
      if (dayRange.end <= now) continue;
      const mine = me ? freeWindows(me, dayRange) : [];
      const together = mine.length > 0 && data.friends.some((f) => {
        const theirs = data.availability[f.id];
        return theirs ? intersect(mine, freeWindows(theirs, dayRange)).some((o) => o.end - o.start >= 3600000) : false;
      });
      const events = data.activities.filter((a) => localDayStart(new Date(a.starts_at).getTime()) === day).length;
      out[day] = { events, free: mine.length > 0, together };
    }
    return out;
  }, [data, meId, month, now]);

  if (loading && !data) return <Loading />;

  const dayRange = { start: selected, end: selected + DAY_MS };
  const mine = data?.availability[meId ?? ''] ? freeWindows(data.availability[meId!], dayRange) : [];
  const people: TimelinePerson[] = [
    { profile, label: 'You', windows: mine, overlap: [] },
    ...(data?.friends ?? [])
      .map((f) => {
        const windows = data?.availability[f.id] ? freeWindows(data.availability[f.id], dayRange) : [];
        return { profile: f, label: displayName(f).split(' ')[0], windows, overlap: intersect(mine, windows) };
      })
      .sort((a, b) => b.overlap.length - a.overlap.length || b.windows.length - a.windows.length),
  ];
  const dayActivities = (data?.activities ?? []).filter((a) => localDayStart(new Date(a.starts_at).getTime()) === selected);
  const events = dayActivities.map((a) => ({
    id: a.id,
    title: a.title,
    start: new Date(a.starts_at).getTime(),
    end: new Date(a.ends_at).getTime(),
    color: Colors.pink,
  }));

  const shiftMonth = (delta: number) => {
    const m = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(m);
    setSelected(m.getMonth() === new Date(now).getMonth() && m.getFullYear() === new Date(now).getFullYear() ? localDayStart(now) : m.getTime());
  };

  const selectedLabel = new Date(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const selectDay = (d: number) => {
    setSelected(d);
    const m = new Date(d);
    if (m.getMonth() !== month.getMonth() || m.getFullYear() !== month.getFullYear()) setMonth(new Date(m.getFullYear(), m.getMonth(), 1));
  };
  const shift = (delta: number) => {
    if (expanded) return shiftMonth(delta);
    const d = new Date(selected);
    d.setDate(d.getDate() + delta * 7);
    selectDay(localDayStart(d.getTime()));
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} center={false}>
      <View style={{ gap: Spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} accessibilityLabel="Show full month">
            <Row gap={8}>
              <T variant="largeTitle">{month.toLocaleDateString(undefined, { month: 'long' })}</T>
              <Icon name={expanded ? 'close' : 'calendar'} size={18} color={Colors.textSecondary} />
            </Row>
          </Pressable>
          <Row>
            <IconButton icon="chevronLeft" label={expanded ? 'Previous month' : 'Previous week'} onPress={() => shift(-1)} />
            <IconButton icon="chevron" label={expanded ? 'Next month' : 'Next week'} onPress={() => shift(1)} />
          </Row>
        </Row>
        {expanded ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <MonthCalendar
              month={month}
              selected={selected}
              marks={marks}
              onSelect={(d) => {
                selectDay(d);
                setExpanded(false);
              }}
            />
          </Animated.View>
        ) : (
          <WeekStrip selected={selected} onSelect={selectDay} marks={marks} />
        )}
      </View>

      <Section
        title={selectedLabel}
        action={
          <Button
            title="Plan"
            icon="plus"
            size="sm"
            variant="white"
            onPress={() =>
              router.push({
                pathname: '/activity/new',
                params: { start: String(selected + 18 * 3600000), end: String(selected + 21 * 3600000) },
              })
            }
          />
        }>
        {dayActivities.map((a) => (
          <ActivityCard key={a.id} activity={a} profiles={data?.profiles ?? {}} meId={meId} height={200} />
        ))}
        <Card>
          <DayTimeline
            day={selected}
            people={people}
            events={events}
            now={now}
            startHour={8}
            hourHeight={32}
            onPressFree={(p, w) =>
              p.profile?.id === meId
                ? router.push('/availability')
                : router.push({ pathname: '/activity/new', params: { start: String(w.start), end: String(Math.min(w.end, w.start + 3 * 3600000)), invite: p.profile!.id } })
            }
            onPressEvent={(id) => router.push({ pathname: '/activity/[id]', params: { id } })}
          />
          {mine.length === 0 ? (
            <Button title="Add free time" size="sm" variant="secondary" onPress={() => router.push('/availability')} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
