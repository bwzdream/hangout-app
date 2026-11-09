import { useState } from 'react';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { DAY_MS, formatDay, minutesToLabel } from '@/lib/time';

import { ChipRow } from './chip-row';
import { Chip, T } from './ui';

const TIMES = Array.from({ length: 34 }, (_, i) => 7 * 60 + i * 30); // 7am → 11:30pm

export type TimeRange = { start: number; end: number };

const DURATIONS = [60, 90, 120, 180, 240, 360];

function dayStart(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function minutesOf(ms: number) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Default: next round half-hour today (or 6pm if that's later), for 2 hours. */
export function defaultRange(): TimeRange {
  const now = Date.now();
  const nextHalf = Math.ceil(now / (30 * 60000)) * 30 * 60000;
  const sixPm = dayStart(now) + 18 * 3600000;
  const start = Math.max(nextHalf, sixPm);
  return { start, end: start + 120 * 60000 };
}

/** Chip-based date/time/duration picker that works identically on iOS, Android and web. */
export function TimeRangePicker({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  const [days] = useState(() => Array.from({ length: 14 }, (_, i) => dayStart(Date.now()) + i * DAY_MS));
  const selectedDay = dayStart(value.start);
  const selectedMinute = minutesOf(value.start);
  const duration = Math.round((value.end - value.start) / 60000);

  const set = (day: number, minute: number, dur: number) => {
    // Use Date setters so DST days are handled by the device's local time.
    const d = new Date(day);
    d.setHours(0, minute, 0, 0);
    const start = d.getTime();
    onChange({ start, end: start + dur * 60000 });
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <T variant="overline">Day</T>
      <ChipRow selectedIndex={days.indexOf(selectedDay)}>
        {days.map((d) => (
          <Chip key={d} label={formatDay(d)} selected={d === selectedDay} onPress={() => set(d, selectedMinute, duration)} />
        ))}
      </ChipRow>

      <T variant="overline">Starts</T>
      <ChipRow selectedIndex={TIMES.indexOf(selectedMinute)}>
        {TIMES.map((m) => (
          <Chip key={m} label={minutesToLabel(m)} selected={m === selectedMinute} onPress={() => set(selectedDay, m, duration)} />
        ))}
      </ChipRow>

      <T variant="overline">Duration</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DURATIONS.map((d) => (
          <Chip
            key={d}
            label={d < 60 ? `${d}m` : `${d / 60}h`.replace('.5h', '½h')}
            selected={d === duration}
            onPress={() => set(selectedDay, selectedMinute, d)}
          />
        ))}
      </View>
    </View>
  );
}
