/**
 * "Meet people nearby" — public free time, nearby browsing and hangout requests.
 * The server enforces the rules (opt-in, ~1 km rounding, 2 h/day on the free plan).
 */
import * as Location from 'expo-location';
import { LocationAccuracy } from 'expo-location';
import { Platform } from 'react-native';

import { getProfiles } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';

export const FREE_PUBLIC_MINUTES = 120;

export type PublicStatus = {
  enabled: boolean;
  hasLocation: boolean;
  radiusKm: number;
  usedMinutes: number;
  /** null = unlimited (Plus) */
  limitMinutes: number | null;
};

export type PublicSlot = { id: string; starts_at: string; ends_at: string; note: string };

export type NearbySlot = {
  slot_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  starts_at: string;
  ends_at: string;
  note: string;
  distance_km: number;
  overlaps_mine: boolean;
  my_request: 'pending' | 'accepted' | 'declined' | 'cancelled' | null;
};

export type HangoutRequest = {
  id: string;
  from_user: string;
  to_user: string;
  slot_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  activity_id: string | null;
  created_at: string;
  slot?: PublicSlot;
  other?: Profile;
};

/** Thrown when the free daily allowance would be exceeded. */
export class PublicLimitError extends Error {
  constructor(public minutesLeft: number) {
    super(`Free accounts can share 2 hours of public time per day (${minutesLeft} min left).`);
  }
}

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getPublicStatus(dayOf: number = Date.now()): Promise<PublicStatus> {
  const { data, error } = await supabase.rpc('my_public_status', { p_day_of: new Date(dayOf).toISOString() });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    enabled: !!row.enabled,
    hasLocation: !!row.has_location,
    radiusKm: row.radius_km ?? 10,
    usedMinutes: row.used_minutes ?? 0,
    limitMinutes: row.limit_minutes ?? null,
  };
}

/** Rough location (the server rounds again to ~1 km). Web uses the browser's location. */
export async function getRoughLocation(): Promise<{ lat: number; lng: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location isn’t available in this browser'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: +p.coords.latitude.toFixed(2), lng: +p.coords.longitude.toFixed(2) }),
        () => reject(new Error('Location permission was not given')),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    });
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Location permission was not given');
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: LocationAccuracy.Low }));
  return { lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) };
}

export async function goPublic(radiusKm = 10) {
  const me = await uid();
  const { lat, lng } = await getRoughLocation();
  const { error } = await supabase.from('public_profiles').upsert({ user_id: me, enabled: true, lat, lng, radius_km: radiusKm });
  if (error) throw new Error(error.message);
}

export async function refreshLocation() {
  const me = await uid();
  const { lat, lng } = await getRoughLocation();
  await supabase.from('public_profiles').update({ lat, lng }).eq('user_id', me);
}

export async function setRadius(radiusKm: number) {
  const me = await uid();
  const { error } = await supabase.from('public_profiles').update({ radius_km: radiusKm }).eq('user_id', me);
  if (error) throw new Error(error.message);
}

/** Stop being public: hide from everyone and remove upcoming public time. */
export async function stopPublic() {
  const me = await uid();
  await supabase.from('public_slots').delete().eq('user_id', me).gt('ends_at', new Date().toISOString());
  const { error } = await supabase.from('public_profiles').update({ enabled: false }).eq('user_id', me);
  if (error) throw new Error(error.message);
}

export async function getMyPublicSlots(): Promise<PublicSlot[]> {
  const me = await uid();
  const { data, error } = await supabase
    .from('public_slots')
    .select('id, starts_at, ends_at, note')
    .eq('user_id', me)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicSlot[];
}

export async function addPublicSlot(start: number, end: number, note: string) {
  const me = await uid();
  const { error } = await supabase
    .from('public_slots')
    .insert({ user_id: me, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), note: note.trim() });
  if (error) {
    if (error.message.includes('public_time_limit')) {
      const left = Number(/(\d+) minutes left/.exec(error.details ?? '')?.[1] ?? 0);
      throw new PublicLimitError(left);
    }
    if (error.message.includes('public_mode_off')) throw new Error('Turn on “Meet people nearby” first.');
    throw new Error(error.message);
  }
}

export async function deletePublicSlot(id: string) {
  const { error } = await supabase.from('public_slots').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function nearbySlots(from: number, to: number): Promise<NearbySlot[]> {
  const { data, error } = await supabase.rpc('nearby_public_slots', {
    p_from: new Date(from).toISOString(),
    p_to: new Date(to).toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbySlot[];
}

export async function sendHangoutRequest(slotId: string, message = '') {
  const me = await uid();
  // to_user is filled in by the server from the slot's owner.
  const { error } = await supabase.from('hangout_requests').insert({ from_user: me, to_user: me, slot_id: slotId, message });
  if (error) throw new Error(error.message.includes('row-level security') ? 'You can’t send this request.' : error.message);
}

export async function answerRequest(id: string, status: 'accepted' | 'declined' | 'cancelled') {
  const { error } = await supabase.from('hangout_requests').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Requests I've received and sent, newest first, with the other person and the slot. */
export async function getHangoutRequests(): Promise<{ incoming: HangoutRequest[]; outgoing: HangoutRequest[] }> {
  const me = await uid();
  const { data, error } = await supabase.rpc('my_hangout_requests');
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as (HangoutRequest & { starts_at: string; ends_at: string; note: string })[]).map((r) => ({
    ...r,
    slot: { id: r.slot_id, starts_at: r.starts_at, ends_at: r.ends_at, note: r.note },
  }));
  const people = await getProfiles(rows.map((r) => (r.from_user === me ? r.to_user : r.from_user)));
  const withOther = rows.map((r) => ({ ...r, other: people[r.from_user === me ? r.to_user : r.from_user] }));
  return {
    incoming: withOther.filter((r) => r.to_user === me && r.status !== 'cancelled'),
    outgoing: withOther.filter((r) => r.from_user === me && r.status !== 'cancelled'),
  };
}

export async function blockUser(userId: string) {
  const me = await uid();
  const { error } = await supabase.from('blocks').insert({ blocker_id: me, blocked_id: userId });
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
}

export const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h && min ? `${h}h ${min}m` : h ? `${h}h` : `${min}m`;
};
