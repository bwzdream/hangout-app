import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Card, Empty, Header, Loading, Row, Screen, T, displayName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { getAvailability, getFriends } from '@/lib/api';
import { freeWindows, intersect, type Interval } from '@/lib/availability';
import { DAY_MS, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

const DAY_START_H = 8; // timeline shows 8am → midnight
const DAY_END_H = 24;

function localDayStart(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function Timeline({ windows, overlap, dayStart }: { windows: Interval[]; overlap?: Interval[]; dayStart: number }) {
  const from = dayStart + DAY_START_H * 3600000;
  const span = (DAY_END_H - DAY_START_H) * 3600000;
  const bar = (w: Interval, color: string) => {
    const s = Math.max(w.start, from);
    const e = Math.min(w.end, from + span);
    if (e <= s) return null;
    return (
      <View
        key={`${color}-${w.start}`}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${((s - from) / span) * 100}%`,
          width: `${((e - s) / span) * 100}%`,
          backgroundColor: color,
          borderRadius: 4,
        }}
      />
    );
  };
  return (
    <View style={{ height: 8, width: '100%', borderRadius: 4, backgroundColor: Colors.busy, overflow: 'hidden' }}>
      {windows.map((w) => bar(w, Colors.free))}
      {(overlap ?? []).map((w) => bar(w, Colors.accent))}
    </View>
  );
}

function DayPicker({ days, value, onChange }: { days: number[]; value: number; onChange: (d: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {days.map((d) => {
        const date = new Date(d);
        const on = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            style={{
              width: 52,
              paddingVertical: 10,
              borderRadius: Radius.md,
              alignItems: 'center',
              gap: 2,
              backgroundColor: on ? Colors.white : Colors.surface,
            }}>
            <T variant="overline" color={on ? Colors.onAccent : Colors.textTertiary} style={{ fontSize: 10 }}>
              {date.toLocaleDateString(undefined, { weekday: 'short' })}
            </T>
            <T variant="heading" color={on ? Colors.onAccent : Colors.text}>
              {date.getDate()}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function WhosFree() {
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [now] = useState(() => Date.now());
  const [days] = useState(() => Array.from({ length: 14 }, (_, i) => localDayStart(now) + i * DAY_MS));
  const [day, setDay] = useState(days[0]);

  const { data, loading, refreshing, refresh } = useData(async () => {
    if (!meId) return null;
    const range = { start: days[0], end: days[days.length - 1] + DAY_MS };
    const friends = await getFriends();
    const availability = await getAvailability([meId, ...friends.friends.map((f) => f.id)], range);
    return { friends: friends.friends, availability };
  });

  if (loading && !data) return <Loading />;

  const dayRange = { start: Math.max(day, now), end: day + DAY_MS };
  const mine = data?.availability[meId ?? ''] ? freeWindows(data.availability[meId!], dayRange) : [];

  const rows: { profile: Profile; windows: Interval[]; overlap: Interval[] }[] = (data?.friends ?? [])
    .map((f) => {
      const windows = data?.availability[f.id] ? freeWindows(data.availability[f.id], dayRange) : [];
      return { profile: f, windows, overlap: intersect(mine, windows) };
    })
    .sort((a, b) => b.overlap.length - a.overlap.length || b.windows.length - a.windows.length);

  const monthLabel = new Date(day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header overline={monthLabel} title="Who's free" />

      <DayPicker days={days} value={day} onChange={setDay} />

      <Card style={{ gap: Spacing.lg }}>
        <Row style={{ justifyContent: 'space-between', paddingLeft: 52 }}>
          {['8a', '12p', '4p', '8p', '12a'].map((l) => (
            <T key={l} variant="caption" color={Colors.textTertiary} style={{ fontSize: 11 }}>
              {l}
            </T>
          ))}
        </Row>

        <Row gap={Spacing.md}>
          <Avatar profile={profile} size={36} />
          <View style={{ flex: 1, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label">You</T>
              {mine.length === 0 ? (
                <Pressable onPress={() => router.push('/availability')}>
                  <T variant="caption" color={Colors.text} style={{ fontWeight: '600' }}>
                    Add free time
                  </T>
                </Pressable>
              ) : null}
            </Row>
            <Timeline windows={mine} dayStart={day} />
          </View>
        </Row>

        {rows.map(({ profile: p, windows, overlap }) => (
          <Row key={p.id} gap={Spacing.md}>
            <Avatar profile={p} size={36} />
            <View style={{ flex: 1, gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="label">{displayName(p)}</T>
                {overlap.length > 0 ? (
                  <T variant="caption" color={Colors.accent} style={{ fontWeight: '600' }}>
                    {formatTime(overlap[0].start)} – {formatTime(overlap[0].end)}
                  </T>
                ) : null}
              </Row>
              <Timeline windows={windows} overlap={overlap} dayStart={day} />
            </View>
          </Row>
        ))}

        <Row gap={Spacing.lg} style={{ paddingTop: Spacing.xs }}>
          <Row gap={6}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: Colors.free }} />
            <T variant="caption">Free</T>
          </Row>
          <Row gap={6}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: Colors.accent }} />
            <T variant="caption">Free with you</T>
          </Row>
        </Row>
      </Card>

      {data && data.friends.length === 0 ? (
        <Empty icon="friends" title="No friends yet" body="Add friends to see their free time next to yours." />
      ) : null}

      <Row>
        <Button title="Edit free time" variant="secondary" size="sm" onPress={() => router.push('/availability')} />
        <Button title="New hangout" variant="white" size="sm" onPress={() => router.push('/activity/new')} />
      </Row>
    </Screen>
  );
}
