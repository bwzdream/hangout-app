/**
 * Time-zone helpers built on Intl (works on Hermes, web and Node) so we don't
 * need a heavy date library.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(ms: number, tz: string): Parts {
  const out: Record<string, string> = {};
  for (const p of formatterFor(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

/** Offset (ms) of a time zone from UTC at a given instant. */
function tzOffset(ms: number, tz: string) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(ms / 60000) * 60000;
}

/** Convert a wall-clock time in `tz` to a UTC instant. */
export function zonedToUtc(year: number, month: number, day: number, minuteOfDay: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let result = guess - tzOffset(guess, tz);
  // Second pass handles DST transitions.
  result = guess - tzOffset(result, tz);
  return result;
}

/** UTC instant of local midnight for the day containing `ms` in `tz`. */
export function startOfZonedDay(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return zonedToUtc(p.year, p.month, p.day, 0, tz);
}

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatTime(ms: number | string | Date): string {
  const d = new Date(ms);
  return minutesToLabel(d.getHours() * 60 + d.getMinutes());
}

export function formatDay(ms: number | string | Date): string {
  const d = new Date(ms);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startD - startToday) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatRange(start: number | string, end: number | string): string {
  return `${formatDay(start)} · ${formatTime(start)}–${formatTime(end)}`;
}

export function timeLeft(expiresAt: string | number): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}
