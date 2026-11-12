import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { Interval } from '@/lib/availability';
import { DAY_MS } from '@/lib/time';
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
  minDay,
}: {
  /** Days before this are shown faded and can't be selected. */
  minDay?: number;
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
            const past = minDay !== undefined && day < minDay;
            return (
              <Pressable key={day} disabled={past} onPress={() => onSelect(day)} style={[styles.cell, past && { opacity: 0.3 }]}>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: Colors.accent },
                  ]}>
                  <T
                    variant="label"
                    color={isSelected ? Colors.onAccent : isToday ? Colors.accentInk : inMonth ? Colors.text : Colors.textTertiary}
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

export type TimelinePing = { id: string; start: number; end: number; message: string };
export type TimelinePerson = {
  profile: Profile | null;
  label: string;
  windows: Interval[];
  overlap: Interval[];
  pings?: TimelinePing[];
};
export type TimelineEvent = { id: string; title: string; start: number; end: number; color: string };

const shortTime = (ms: number) => {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
};

/**
 * Vertical day view (a timetable): hours run top → bottom, one column per person.
 * Soft mint = free, solid mint = free with you, ink = live ping. Blocks are labelled
 * with their times and are tappable.
 */
export function DayTimeline({
  day,
  people,
  events = [],
  onPressEvent,
  onPressFree,
  onPressPing,
  now,
  startHour = 7,
  endHour = 24,
  hourHeight = 44,
}: {
  day: number;
  people: TimelinePerson[];
  events?: TimelineEvent[];
  onPressEvent?: (id: string) => void;
  onPressFree?: (person: TimelinePerson, window: Interval) => void;
  onPressPing?: (id: string) => void;
  now: number;
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
}) {
  const HOUR = hourHeight;
  const top = day + startHour * 3600000;
  const bottom = day + endHour * 3600000;
  const totalH = (endHour - startHour) * HOUR;
  const y = (ms: number) => ((Math.max(top, Math.min(ms, bottom)) - top) / 3600000) * HOUR;
  const showNow = now >= top && now < Math.min(bottom, day + DAY_MS);

  const block = (
    w: Interval,
    key: string,
    color: string,
    ink: string,
    label: string | null,
    onPress?: () => void,
  ) => {
    const t = y(w.start);
    const h = y(w.end) - t;
    if (h <= 0) return null;
    return (
      <Pressable
        key={key}
        onPress={onPress}
        disabled={!onPress}
        style={{ position: 'absolute', top: t, height: h, left: 2, right: 2, borderRadius: 10, backgroundColor: color, padding: 5, overflow: 'hidden' }}>
        {h >= 30 ? (
          <T variant="caption" color={ink} numberOfLines={h >= 60 ? 3 : 1} style={{ fontSize: 11, lineHeight: 13, fontWeight: '700' }}>
            {label ?? `${shortTime(w.start)}–${shortTime(w.end)}`}
          </T>
        ) : null}
        {label && h >= 48 ? (
          <T variant="caption" color={ink} style={{ fontSize: 10, lineHeight: 12, opacity: 0.75 }}>
            {shortTime(w.start)}–{shortTime(w.end)}
          </T>
        ) : null}
      </Pressable>
    );
  };

  const columns = (
    <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
      {events.length > 0 ? (
        <View style={{ flex: 1.6, minWidth: 96 }}>
          <View style={styles.colHeader}>
            <View style={[styles.headerBadge, { backgroundColor: Colors.text }]}>
              <T variant="caption" color={Colors.background} style={{ fontSize: 10, fontWeight: '800' }}>
                PLANS
              </T>
            </View>
          </View>
          <View style={[styles.track, { height: totalH }]}>
            {events.map((e) =>
              block({ start: e.start, end: e.end }, e.id, e.color, Colors.onPink, e.title, onPressEvent ? () => onPressEvent(e.id) : undefined),
            )}
          </View>
        </View>
      ) : null}
      {people.map((p, i) => (
        <View key={p.profile?.id ?? i} style={{ flex: 1, minWidth: 56 }}>
          <View style={styles.colHeader}>
            <Avatar profile={p.profile} size={30} ring={p.pings?.length ? Colors.text : undefined} />
            <T variant="caption" color={Colors.text} numberOfLines={1} style={{ fontSize: 11, lineHeight: 13, fontWeight: '600' }}>
              {p.label}
            </T>
          </View>
          <View style={[styles.track, { height: totalH }]}>
            {p.windows.map((w) =>
              block(w, `f${w.start}`, Colors.free, Colors.text, null, onPressFree ? () => onPressFree(p, w) : undefined),
            )}
            {p.overlap.map((w) =>
              block(w, `o${w.start}`, Colors.accent, Colors.onAccent, null, onPressFree ? () => onPressFree(p, w) : undefined),
            )}
            {(p.pings ?? []).map((pg) =>
              block(pg, `p${pg.id}`, Colors.text, Colors.background, pg.message || 'Free!', onPressPing ? () => onPressPing(pg.id) : undefined),
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const labelEvery = endHour - startHour > 10 ? 2 : 1;

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 30, height: 52 + totalH }}>
        {hours
          .filter((h, i) => i % labelEvery === 0 && h < 24)
          .map((h) => (
            <T key={h} variant="caption" color={Colors.textTertiary} style={{ position: 'absolute', top: 52 + (h - startHour) * HOUR - 7, fontSize: 11 }}>
              {h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
            </T>
          ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Hour grid lines (behind the blocks) */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: 52 }]}>
            {hours.map((h, i) => (
              <View key={h} style={{ position: 'absolute', top: i * HOUR, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: Colors.hairline }} />
            ))}
          </View>
          {columns}
          {showNow ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 52 + y(now) - 1, left: 0, right: 0, height: 2, backgroundColor: Colors.danger }}>
              <View style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger }} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Compact week row: tap a day, swipe-free arrows to move a week. */
export function WeekStrip({
  selected,
  onSelect,
  marks,
  minDay,
}: {
  selected: number;
  onSelect: (day: number) => void;
  marks: Record<number, DayMark>;
  minDay?: number;
}) {
  const [today] = useState(() => localDayStart(Date.now()));
  const sel = new Date(selected);
  const weekStart = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() - sel.getDay()).getTime();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.getTime();
  });
  return (
    <View style={{ flexDirection: 'row' }}>
      {days.map((day) => {
        const d = new Date(day);
        const isSel = day === selected;
        const isToday = day === today;
        const past = minDay !== undefined && day < minDay;
        const mark = marks[day];
        return (
          <Pressable key={day} disabled={past} onPress={() => onSelect(day)} style={{ flex: 1, alignItems: 'center', gap: 4, opacity: past ? 0.35 : 1 }}>
            <T variant="caption" color={isSel ? Colors.text : Colors.textTertiary} style={{ fontSize: 11, fontWeight: '700' }}>
              {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </T>
            <View style={[styles.dayCircle, isSel && { backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.text }]}>
              <T variant="label" color={isSel ? Colors.onAccent : isToday ? Colors.accentInk : Colors.text} style={{ fontSize: 17, fontWeight: isSel || isToday ? '800' : '500' }}>
                {d.getDate()}
              </T>
            </View>
            <View style={styles.dots}>
              {mark?.together ? <View style={[styles.dot, { backgroundColor: Colors.accentInk }]} /> : null}
              {mark?.events ? <View style={[styles.dot, { backgroundColor: Colors.pink }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  colHeader: { height: 52, alignItems: 'center', gap: 3, justifyContent: 'flex-start' },
  headerBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  track: { borderRadius: Radius.sm, backgroundColor: Colors.surface },
});
