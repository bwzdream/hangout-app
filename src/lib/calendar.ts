/**
 * Calendar sync (read busy times) and "add to calendar".
 *
 * Native: expo-calendar reads every calendar synced to the device — iCloud,
 * Google, Outlook, etc. — after one permission prompt.
 * Web: we offer an .ics download for "add to calendar". Reading Google
 * Calendar on web (OAuth free/busy) is planned next.
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { buildIcs, type CalendarEventInput } from './ics';
import { supabase } from './supabase';

export type { CalendarEventInput };

const SYNC_DAYS = 28;

export const canSyncDeviceCalendar = Platform.OS === 'ios' || Platform.OS === 'android';

export async function requestCalendarAccess(): Promise<boolean> {
  if (!canSyncDeviceCalendar) return false;
  const res = await Calendar.requestCalendarPermissions();
  return res.granted;
}

/**
 * Read busy events from device calendars and replace this user's upcoming
 * device busy blocks. Only start/end times are uploaded — never titles.
 */
export async function syncDeviceCalendar(userId: string): Promise<{ blocks: number; calendars: number }> {
  if (!(await requestCalendarAccess())) throw new Error('Calendar permission was not granted');

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const now = new Date();
  const end = new Date(now.getTime() + SYNC_DAYS * 24 * 60 * 60 * 1000);
  const events = calendars.length ? await Calendar.listEvents(calendars, now, end) : [];

  const blocks = events
    .filter((e) => !e.allDay) // all-day events (birthdays, holidays) usually don't block hangouts
    .filter((e) => e.availability !== Calendar.Availability.FREE)
    .map((e) => ({
      user_id: userId,
      starts_at: new Date(e.startDate).toISOString(),
      ends_at: new Date(e.endDate).toISOString(),
      source: 'device',
    }))
    .filter((b) => b.ends_at > b.starts_at);

  const { error: delError } = await supabase
    .from('busy_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'device')
    .gte('ends_at', now.toISOString());
  if (delError) throw delError;

  if (blocks.length) {
    const { error } = await supabase.from('busy_blocks').insert(blocks);
    if (error) throw error;
  }
  return { blocks: blocks.length, calendars: calendars.length };
}

/** Add an activity to the user's calendar. Returns a short status message. */
export async function addToCalendar(event: CalendarEventInput): Promise<string> {
  if (Platform.OS === 'web') {
    downloadIcs(event);
    return 'Calendar file downloaded';
  }

  const perm = await Calendar.requestCalendarPermissions();
  if (!perm.granted) throw new Error('Calendar permission was not granted');

  let target: Calendar.ExpoCalendar | undefined;
  if (Platform.OS === 'ios') {
    target = Calendar.getDefaultCalendarSync();
  } else {
    const calendars = await Calendar.getCalendars();
    const writable = calendars.filter((c) => c.allowsModifications);
    target = writable.find((c) => c.isPrimary) ?? writable[0];
  }
  if (!target) throw new Error('No writable calendar found');

  await target.createEvent({
    title: event.title,
    startDate: new Date(event.startsAt),
    endDate: new Date(event.endsAt),
    location: event.location || undefined,
    notes: event.notes || undefined,
  });
  return 'Added to your calendar';
}

function downloadIcs(event: CalendarEventInput) {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'hangout'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
