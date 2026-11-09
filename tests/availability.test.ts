import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expandRules,
  findOverlaps,
  freeWindows,
  groupOverlaps,
  intersect,
  merge,
  subtract,
  suggestFreeTime,
  type UserAvailability,
} from '../src/lib/availability';
import { buildIcs } from '../src/lib/ics';
import { zonedParts, zonedToUtc } from '../src/lib/time';

const H = 3600000;
const iso = (s: string) => new Date(s).getTime();

test('merge / subtract / intersect', () => {
  assert.deepEqual(merge([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 2, end: 6 }]), [{ start: 1, end: 8 }]);
  assert.deepEqual(subtract([{ start: 0, end: 10 }], [{ start: 2, end: 3 }, { start: 5, end: 12 }]), [
    { start: 0, end: 2 },
    { start: 3, end: 5 },
  ]);
  assert.deepEqual(intersect([{ start: 0, end: 5 }, { start: 8, end: 12 }], [{ start: 4, end: 10 }]), [
    { start: 4, end: 5 },
    { start: 8, end: 10 },
  ]);
});

test('zonedToUtc round-trips across time zones, including DST', () => {
  // 6pm in New York on a summer day = 22:00 UTC (EDT, -4)
  assert.equal(new Date(zonedToUtc(2026, 7, 10, 18 * 60, 'America/New_York')).toISOString(), '2026-07-10T22:00:00.000Z');
  // 6pm in New York in winter = 23:00 UTC (EST, -5)
  assert.equal(new Date(zonedToUtc(2026, 12, 10, 18 * 60, 'America/New_York')).toISOString(), '2026-12-10T23:00:00.000Z');
  // Day after US DST ends (Nov 1 2026)
  assert.equal(new Date(zonedToUtc(2026, 11, 2, 9 * 60, 'America/Los_Angeles')).toISOString(), '2026-11-02T17:00:00.000Z');
  // Tokyo has no DST
  assert.equal(new Date(zonedToUtc(2026, 3, 1, 0, 'Asia/Tokyo')).toISOString(), '2026-02-28T15:00:00.000Z');
  const p = zonedParts(iso('2026-11-09T02:00:00Z'), 'America/Los_Angeles');
  assert.deepEqual([p.month, p.day, p.hour, p.weekday], [11, 8, 18, 0]); // Sunday Nov 8, 6pm
});

test('expandRules places weekly rules in the owner time zone', () => {
  // Monday 2026-11-09 … Sunday 2026-11-15
  const range = { start: iso('2026-11-09T00:00:00Z'), end: iso('2026-11-16T12:00:00Z') };
  const out = expandRules([{ weekday: 5, start_minute: 18 * 60, end_minute: 22 * 60 }], 'America/New_York', range);
  assert.equal(out.length, 1);
  assert.equal(new Date(out[0].start).toISOString(), '2026-11-13T23:00:00.000Z'); // Fri 6pm EST
  assert.equal(out[0].end - out[0].start, 4 * H);
});

test('free time = rules + one-off slots − busy calendar blocks', () => {
  const range = { start: iso('2026-11-09T00:00:00Z'), end: iso('2026-11-16T00:00:00Z') };
  const user: UserAvailability = {
    timezone: 'UTC',
    rules: [{ weekday: 2, start_minute: 18 * 60, end_minute: 22 * 60 }], // Tue 18-22
    freeSlots: [{ starts_at: '2026-11-14T13:00:00Z', ends_at: '2026-11-14T17:00:00Z' }],
    busy: [{ starts_at: '2026-11-10T19:00:00Z', ends_at: '2026-11-10T20:00:00Z' }],
  };
  const free = freeWindows(user, range).map((i) => [new Date(i.start).toISOString(), new Date(i.end).toISOString()]);
  assert.deepEqual(free, [
    ['2026-11-10T18:00:00.000Z', '2026-11-10T19:00:00.000Z'],
    ['2026-11-10T20:00:00.000Z', '2026-11-10T22:00:00.000Z'],
    ['2026-11-14T13:00:00.000Z', '2026-11-14T17:00:00.000Z'],
  ]);
});

test('overlaps across friends in different time zones', () => {
  const range = { start: iso('2026-11-09T00:00:00Z'), end: iso('2026-11-16T00:00:00Z') };
  // Me in NYC: Fri 6-10pm EST = 23:00-03:00 UTC
  const me: UserAvailability = { timezone: 'America/New_York', rules: [{ weekday: 5, start_minute: 1080, end_minute: 1320 }], freeSlots: [], busy: [] };
  // Sam in LA: Fri 4-8pm PST = 00:00-04:00 UTC (Sat)
  const sam: UserAvailability = { timezone: 'America/Los_Angeles', rules: [{ weekday: 5, start_minute: 960, end_minute: 1200 }], freeSlots: [], busy: [] };
  // Lee: busy all Friday evening
  const lee: UserAvailability = {
    timezone: 'America/New_York',
    rules: [{ weekday: 5, start_minute: 1080, end_minute: 1320 }],
    freeSlots: [],
    busy: [{ starts_at: '2026-11-13T22:00:00Z', ends_at: '2026-11-14T04:00:00Z' }],
  };
  const overlaps = findOverlaps(me, { sam, lee }, range);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].friendId, 'sam');
  assert.equal(new Date(overlaps[0].start).toISOString(), '2026-11-14T00:00:00.000Z');
  assert.equal(overlaps[0].end - overlaps[0].start, 3 * H);

  const groups = groupOverlaps(findOverlaps(me, { sam, alex: sam }, range));
  assert.deepEqual(groups[0].friendIds.sort(), ['alex', 'sam']);
});

test('suggestFreeTime finds open social hours, skipping busy & already-free time', () => {
  const start = Date.now();
  const range = { start, end: start + 7 * 24 * H };
  const user: UserAvailability = { timezone: 'UTC', rules: [], freeSlots: [], busy: [] };
  const suggestions = suggestFreeTime(user, range, 90, 50);
  assert.ok(suggestions.length >= 5);
  for (const s of suggestions) assert.ok(s.end - s.start >= 90 * 60000);
  // Fill all of it as busy → no suggestions.
  const busyUser = { ...user, busy: [{ starts_at: new Date(range.start).toISOString(), ends_at: new Date(range.end).toISOString() }] };
  assert.equal(suggestFreeTime(busyUser, range).length, 0);
});

test('ics export', () => {
  const ics = buildIcs({ title: 'Tacos, yay', startsAt: '2026-11-13T23:00:00Z', endsAt: '2026-11-14T01:00:00Z', location: 'Lupe’s' });
  assert.match(ics, /DTSTART:20261113T230000Z/);
  assert.match(ics, /SUMMARY:Tacos\\, yay/);
});
