import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { Interval } from '@/lib/availability';
import { DAY_MS, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';

import { Avatar, T } from './ui';

export const localDayStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export type DayMark = { events: number; free: boolean; together: boolean };

/** Month grid. Days show a lime dot when you're free with a friend and white dots for hangouts. */
export function MonthCalendar({
  month,
  selected,
  onSelect,
  marks,
}: {
  month: Date; // any date inside the month
  selected: number;
  onSelect: (day: number) => void;
  marks: Record<number, DayMark>;
}) {
  const [today] = useState(() => localDayStart(Date.now()));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()).getTime();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d.getTime();
  });
  const rows = cells[35] && new Date(cells[35]).getMonth() !== month.getMonth() ? 5 : 6;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <T key={i} variant="overline" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {d}
          </T>
        ))}
      </View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((day) => {
            const d = new Date(day);
            const inMonth = d.getMonth() === month.getMonth();
            const isSelected = day === selected;
            const isToday = day === today;
            const mark = marks[day];
            return (
              <Pressable key={day} onPress={() => onSelect(day)} style={styles.cell}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: Colors.accent },
                  ]}>
                  <T
                    variant="label"
                    color={isSelected ? Colors.onAccent : isToday ? Colors.accent : inMonth ? Colors.text : Colors.textTertiary}
                    style={{ fontSize: 17, fontWeight: isSelected || isToday ? '900' : '600' }}>
                    {d.getDate()}
                  </T>
                </View>
                <View style={styles.dots}>
                  {mark?.together ? <View style={[styles.dot, { backgroundColor: Colors.accent }]} /> : null}
                  {Array.from({ length: Math.min(mark?.events ?? 0, 3) }, (_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: Colors.pink }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export type TimelinePerson = { profile: Profile | null; label: string; windows: Interval[]; overlap: Interval[] };
export type TimelineEvent = { id: string; title: string; start: number; end: number; color: string };

const START_H = 7;
const END_H = 24;
const HOUR = 44; // px per hour

/**
 * Vertical day view: hours run top → bottom, one column per person.
 * Free time is a soft lime block; time you're both free is solid lime; hangouts are labelled bars.
 */
export function DayTimeline({
  day,
  people,
  events,
  onPressEvent,
  now,
}: {
  day: number;
  people: TimelinePerson[];
  events: TimelineEvent[];
  onPressEvent?: (id: string) => void;
  now: number;
}) {
  const top = day + START_H * 3600000;
  const totalH = (END_H - START_H) * HOUR;
  const y = (ms: number) => ((Math.max(top, Math.min(ms, day + END_H * 3600000)) - top) / 3600000) * HOUR;
  const showNow = now >= top && now < day + DAY_MS;

  const block = (w: Interval, color: string, key: string) => {
    const t = y(w.start);
    const h = y(w.end) - t;
    if (h <= 0) return null;
    return <View key={key} style={{ position: 'absolute', top: t, height: h, left: 3, right: 3, borderRadius: 8, backgroundColor: color }} />;
  };

  const columns = (
    <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
      {events.length > 0 ? (
        <View style={{ width: 120 }}>
          <View style={styles.colHeader}>
            <T variant="overline" style={{ fontSize: 10 }}>
              Plans
            </T>
          </View>
          <View style={[styles.track, { height: totalH }]}>
            {events.map((e) => {
              const t = y(e.start);
              const h = Math.max(28, y(e.end) - t);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => onPressEvent?.(e.id)}
                  style={{
                    position: 'absolute',
                    top: t,
                    height: h,
                    left: 3,
                    right: 3,
                    borderRadius: 8,
                    padding: 6,
                    backgroundColor: e.color,
                  }}>
                  <T variant="caption" color="#fff" numberOfLines={2} style={{ fontWeight: '700', fontSize: 12, lineHeight: 15 }}>
                    {e.title}
                  </T>
                  <T variant="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 11, lineHeight: 13 }}>
                    {formatTime(e.start)}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {people.map((p, i) => (
        <View key={p.profile?.id ?? i} style={{ flex: 1, minWidth: 52 }}>
          <View style={styles.colHeader}>
            <Avatar profile={p.profile} size={28} />
            <T variant="caption" numberOfLines={1} style={{ fontSize: 11, lineHeight: 13 }}>
              {p.label}
            </T>
          </View>
          <View style={[styles.track, { height: totalH }]}>
            {p.windows.map((w) => block(w, Colors.free, `f${w.start}`))}
            {p.overlap.map((w) => block(w, Colors.accent, `o${w.start}`))}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Hour labels */}
      <View style={{ width: 34, height: 50 + totalH }}>
        {Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i)
          .filter((h) => h % 2 === 1 || h === END_H)
          .map((h) => (
            <T
              key={h}
              variant="caption"
              color={Colors.textTertiary}
              style={{ position: 'absolute', top: 50 + (h - START_H) * HOUR - 7, fontSize: 11 }}>
              {h === 24 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
            </T>
          ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1 }}>
          {columns}
          {/* Hour grid lines */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: 50 }]}>
            {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
              <View key={i} style={{ position: 'absolute', top: i * HOUR, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: Colors.hairline }} />
            ))}
            {showNow ? (
              <View style={{ position: 'absolute', top: y(now) - 1, left: 0, right: 0, height: 2, backgroundColor: Colors.text }} />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  colHeader: { height: 50, alignItems: 'center', gap: 3, justifyContent: 'flex-start' },
  track: { borderRadius: Radius.sm, backgroundColor: Colors.surface },
});
