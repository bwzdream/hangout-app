import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { getAvailability, getFriends } from '@/lib/api';
import { freeWindows, intersect, type Interval } from '@/lib/availability';
import { DAY_MS, formatDay, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

const DAY_START_H = 8; // timeline shows 8am → midnight
const DAY_END_H = 24;

function localDayStart(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function Timeline({ windows, dayStart, highlight }: { windows: Interval[]; dayStart: number; highlight?: boolean }) {
  const theme = useTheme();
  const from = dayStart + DAY_START_H * 3600000;
  const to = dayStart + DAY_END_H * 3600000;
  const span = to - from;
  return (
    <View style={{ height: 14, width: '100%', borderRadius: 7, backgroundColor: theme.busy, overflow: 'hidden' }}>
      {windows.map((w) => {
        const s = Math.max(w.start, from);
        const e = Math.min(w.end, to);
        if (e <= s) return null;
        return (
          <View
            key={w.start}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${((s - from) / span) * 100}%`,
              width: `${((e - s) / span) * 100}%`,
              backgroundColor: highlight ? theme.primary : theme.free,
              borderRadius: 7,
            }}
          />
        );
      })}
    </View>
  );
}

export default function WhosFree() {
  const theme = useTheme();
  const { session, profile } = useAuth();
  const meId = session?.user.id;
  const [now] = useState(() => Date.now());
  const [days] = useState(() => Array.from({ length: 7 }, (_, i) => localDayStart(now) + i * DAY_MS));
  const [day, setDay] = useState(days[0]);

  const { data, loading, refreshing, refresh } = useData(async () => {
    if (!meId) return null;
    const range = { start: days[0], end: days[days.length - 1] + DAY_MS };
    const friends = await getFriends();
    const availability = await getAvailability([meId, ...friends.friends.map((f) => f.id)], range);
    return { friends: friends.friends, availability, range };
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

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <T variant="title">Who's free 📅</T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => (
          <Chip key={d} label={formatDay(d)} selected={d === day} onPress={() => setDay(d)} />
        ))}
      </ScrollView>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="caption">8am</T>
          <T variant="caption">noon</T>
          <T variant="caption">4pm</T>
          <T variant="caption">8pm</T>
          <T variant="caption">12am</T>
        </Row>

        <Row gap={Spacing.md} style={{ marginTop: Spacing.sm }}>
          <Avatar profile={profile} size={32} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="label">You</T>
            <Timeline windows={mine} dayStart={day} />
          </View>
        </Row>

        {mine.length === 0 ? (
          <Pressable onPress={() => router.push('/availability')}>
            <T variant="caption" color={theme.accent} style={{ marginTop: 4 }}>
              No free time set for this day — tap to add some →
            </T>
          </Pressable>
        ) : null}

        {rows.map(({ profile: p, windows, overlap }) => (
          <Row key={p.id} gap={Spacing.md} style={{ marginTop: Spacing.sm }}>
            <Avatar profile={p} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="label">{displayName(p)}</T>
                {overlap.length > 0 ? (
                  <T variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                    both free {formatTime(overlap[0].start)}–{formatTime(overlap[0].end)}
                  </T>
                ) : null}
              </Row>
              <View>
                <Timeline windows={windows} dayStart={day} />
                {overlap.length > 0 ? (
                  <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }} pointerEvents="none">
                    <Timeline windows={overlap} dayStart={day} highlight />
                  </View>
                ) : null}
              </View>
            </View>
          </Row>
        ))}
        <Row style={{ marginTop: Spacing.md }} gap={Spacing.lg}>
          <Row gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.free }} />
            <T variant="caption">free</T>
          </Row>
          <Row gap={6}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary }} />
            <T variant="caption">you're both free</T>
          </Row>
        </Row>
      </Card>

      {data && data.friends.length === 0 ? (
        <Empty emoji="🫥" title="No friends yet" body="Add friends to see their free time here." />
      ) : null}

      <Section title="Quick actions">
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title="Edit my free time" variant="secondary" size="sm" onPress={() => router.push('/availability')} />
          <Button title="Plan a hangout" variant="accent" size="sm" onPress={() => router.push('/activity/new')} />
        </Row>
      </Section>
    </Screen>
  );
}
