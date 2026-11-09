/**
 * The availability engine:
 *   free time  = (recurring rules ∪ one-off free slots) − calendar busy blocks
 *   overlaps   = my free time ∩ a friend's free time
 *   suggestions = calendar gaps at "hangout-friendly" hours that you haven't marked free yet
 */
import type { AvailabilityRule, BusyBlock, FreeSlot } from './types';
import { DAY_MS, startOfZonedDay, zonedParts, zonedToUtc } from './time';

export type Interval = { start: number; end: number };

export type UserAvailability = {
  timezone: string;
  rules: Pick<AvailabilityRule, 'weekday' | 'start_minute' | 'end_minute'>[];
  freeSlots: Pick<FreeSlot, 'starts_at' | 'ends_at'>[];
  busy: Pick<BusyBlock, 'starts_at' | 'ends_at'>[];
};

/** Sort and merge overlapping/touching intervals. */
export function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** a − b */
export function subtract(a: Interval[], b: Interval[]): Interval[] {
  const holes = merge(b);
  const out: Interval[] = [];
  for (const i of merge(a)) {
    let cursor = i.start;
    for (const h of holes) {
      if (h.end <= cursor || h.start >= i.end) continue;
      if (h.start > cursor) out.push({ start: cursor, end: h.start });
      cursor = Math.max(cursor, h.end);
      if (cursor >= i.end) break;
    }
    if (cursor < i.end) out.push({ start: cursor, end: i.end });
  }
  return out;
}

/** a ∩ b */
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const x = merge(a);
  const y = merge(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const start = Math.max(x[i].start, y[j].start);
    const end = Math.min(x[i].end, y[j].end);
    if (end > start) out.push({ start, end });
    if (x[i].end < y[j].end) i++;
    else j++;
  }
  return out;
}

export function clip(intervals: Interval[], range: Interval): Interval[] {
  return intersect(intervals, [range]);
}

/** Expand weekly rules (in the user's time zone) into concrete intervals within range. */
export function expandRules(rules: UserAvailability['rules'], tz: string, range: Interval): Interval[] {
  const out: Interval[] = [];
  // Start a day early so rules that began yesterday evening are included.
  for (let dayMs = startOfZonedDay(range.start, tz) - DAY_MS; dayMs < range.end; dayMs += DAY_MS) {
    const p = zonedParts(dayMs + 12 * 3600 * 1000, tz); // noon avoids DST edge cases
    for (const r of rules) {
      if (r.weekday !== p.weekday) continue;
      out.push({
        start: zonedToUtc(p.year, p.month, p.day, r.start_minute, tz),
        end: zonedToUtc(p.year, p.month, p.day, r.end_minute, tz),
      });
    }
  }
  return clip(out, range);
}

const toIntervals = (rows: { starts_at: string; ends_at: string }[]): Interval[] =>
  rows.map((r) => ({ start: new Date(r.starts_at).getTime(), end: new Date(r.ends_at).getTime() }));

export function freeWindows(user: UserAvailability, range: Interval): Interval[] {
  const free = [...expandRules(user.rules, user.timezone, range), ...clip(toIntervals(user.freeSlots), range)];
  return subtract(free, toIntervals(user.busy));
}

export type Overlap = Interval & { friendId: string };

/** Times when I'm free AND a friend is free, at least `minMinutes` long. */
export function findOverlaps(
  me: UserAvailability,
  friends: Record<string, UserAvailability>,
  range: Interval,
  minMinutes = 60,
): Overlap[] {
  const mine = freeWindows(me, range);
  const out: Overlap[] = [];
  for (const [friendId, f] of Object.entries(friends)) {
    for (const o of intersect(mine, freeWindows(f, range))) {
      if (o.end - o.start >= minMinutes * 60000) out.push({ ...o, friendId });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Group overlaps that cover the same window so we can say "You, Sam & Lee are all free". */
export function groupOverlaps(overlaps: Overlap[]): (Interval & { friendIds: string[] })[] {
  const groups: (Interval & { friendIds: string[] })[] = [];
  for (const o of overlaps) {
    const g = groups.find((x) => Math.max(x.start, o.start) < Math.min(x.end, o.end) &&
      Math.min(x.end, o.end) - Math.max(x.start, o.start) >= 60 * 60000);
    if (g) {
      g.start = Math.max(g.start, o.start);
      g.end = Math.min(g.end, o.end);
      if (!g.friendIds.includes(o.friendId)) g.friendIds.push(o.friendId);
    } else {
      groups.push({ start: o.start, end: o.end, friendIds: [o.friendId] });
    }
  }
  return groups.sort((a, b) => b.friendIds.length - a.friendIds.length || a.start - b.start);
}

/** Hangout-friendly windows: weekday evenings, weekend afternoons & evenings. */
const SOCIAL_HOURS: Record<number, [number, number][]> = {
  0: [[11 * 60, 17 * 60], [18 * 60, 22 * 60]],
  1: [[18 * 60, 22 * 60]],
  2: [[18 * 60, 22 * 60]],
  3: [[18 * 60, 22 * 60]],
  4: [[18 * 60, 22 * 60]],
  5: [[18 * 60, 23 * 60]],
  6: [[11 * 60, 17 * 60], [18 * 60, 23 * 60]],
};

/**
 * Suggest free time: open gaps in your calendar during social hours that you
 * haven't already marked as free.
 */
export function suggestFreeTime(user: UserAvailability, range: Interval, minMinutes = 90, limit = 5): Interval[] {
  const socialRules = Object.entries(SOCIAL_HOURS).flatMap(([weekday, windows]) =>
    windows.map(([start_minute, end_minute]) => ({ weekday: Number(weekday), start_minute, end_minute })),
  );
  const candidates = expandRules(socialRules, user.timezone, { start: Math.max(range.start, Date.now()), end: range.end });
  const alreadyFree = freeWindows(user, range);
  const open = subtract(subtract(candidates, toIntervals(user.busy)), alreadyFree);
  return open.filter((i) => i.end - i.start >= minMinutes * 60000).slice(0, limit);
}

/**
 * Learn from the calendar: weekly slots that were free in each of the last few
 * weeks are good candidates for a *recurring* free-time rule.
 */
export function suggestRecurringRules(
  user: UserAvailability,
  now = Date.now(),
): { weekday: number; start_minute: number; end_minute: number }[] {
  const out: { weekday: number; start_minute: number; end_minute: number }[] = [];
  for (const [weekdayStr, windows] of Object.entries(SOCIAL_HOURS)) {
    const weekday = Number(weekdayStr);
    for (const [start_minute, end_minute] of windows) {
      const already = user.rules.some(
        (r) => r.weekday === weekday && r.start_minute < end_minute && r.end_minute > start_minute,
      );
      if (already) continue;
      const rule = [{ weekday, start_minute, end_minute }];
      // Check the upcoming 3 weeks of synced calendar.
      const range = { start: now, end: now + 21 * DAY_MS };
      const occurrences = expandRules(rule, user.timezone, range);
      if (occurrences.length < 2) continue;
      const busy = toIntervals(user.busy);
      const allClear = occurrences.every((o) => subtract([o], busy).reduce((s, i) => s + i.end - i.start, 0) >= 0.8 * (o.end - o.start));
      if (allClear) out.push({ weekday, start_minute, end_minute });
    }
  }
  return out;
}
