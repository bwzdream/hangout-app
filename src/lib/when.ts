/** Quick time choices shared by pings, hangouts and free time. */
import { DAY_MS } from './time';

export type TimeRange = { start: number; end: number };

export const dayStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Local wall-clock minutes since midnight. */
export const minuteOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/** A time on a given day (DST-safe: uses the device's local clock). */
export const atMinute = (day: number, minute: number) => {
  const d = new Date(day);
  d.setHours(0, minute, 0, 0);
  return d.getTime();
};

const at = (dayOffset: number, hour: number) => atMinute(dayStart(Date.now()) + dayOffset * DAY_MS + 3 * 3600000, hour * 60);

export type Preset = { key: string; label: string; range: () => TimeRange | null };

export const PRESETS: Preset[] = [
  {
    key: 'now',
    label: 'Right now',
    range: () => {
      const start = Math.ceil(Date.now() / 900000) * 900000;
      return { start, end: start + 2 * 3600000 };
    },
  },
  {
    key: 'tonight',
    label: 'Tonight',
    range: () => {
      const end = at(0, 23);
      const start = Math.max(at(0, 18), Math.ceil(Date.now() / 1800000) * 1800000);
      return end - start >= 3600000 ? { start, end } : null;
    },
  },
  { key: 'tomorrow', label: 'Tomorrow night', range: () => ({ start: at(1, 18), end: at(1, 22) }) },
  {
    key: 'weekend',
    label: 'This weekend',
    range: () => {
      const toSat = (6 - new Date().getDay() + 7) % 7 || 7;
      return { start: at(toSat, 12), end: at(toSat, 18) };
    },
  },
];

/** Parts of the day for the picker. Minutes since midnight. */
export const DAYPARTS = [
  { label: 'Morning', start: 9 * 60, end: 12 * 60 },
  { label: 'Lunch', start: 12 * 60, end: 14 * 60 },
  { label: 'Afternoon', start: 14 * 60, end: 17 * 60 },
  { label: 'Evening', start: 18 * 60, end: 21 * 60 },
  { label: 'Late', start: 21 * 60, end: 24 * 60 },
];

export function describeRange(r: TimeRange, fmt: (ms: number) => string) {
  const day = new Date(r.start).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return `${day} · ${fmt(r.start)} – ${fmt(r.end)}`;
}
