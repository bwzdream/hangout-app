import { supabase } from './supabase';
import type { UserAvailability } from './availability';
import type {
  Activity,
  ActivityMember,
  AvailabilityRule,
  Circle,
  FreeSlot,
  Friendship,
  Ping,
  PingResponse,
  Profile,
} from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

// ─── Profiles ────────────────────────────────────────────────
export async function getProfile(id: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return check(res);
}

export async function getProfiles(ids: string[]): Promise<Record<string, Profile>> {
  if (ids.length === 0) return {};
  const rows = check(await supabase.from('profiles').select('*').in('id', [...new Set(ids)])) as Profile[];
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>) {
  const id = await uid();
  check(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return [];
  const me = await uid();
  const rows = check(
    await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', me)
      .limit(20),
  ) as Profile[];
  return rows;
}

// ─── Friends ─────────────────────────────────────────────────
export type FriendsState = {
  friends: Profile[];
  incoming: { friendship: Friendship; profile: Profile }[];
  outgoing: { friendship: Friendship; profile: Profile }[];
  friendshipByUser: Record<string, Friendship>;
};

export async function getFriends(): Promise<FriendsState> {
  const me = await uid();
  const rows = check(await supabase.from('friendships').select('*')) as Friendship[];
  const otherId = (f: Friendship) => (f.requester_id === me ? f.addressee_id : f.requester_id);
  const profiles = await getProfiles(rows.map(otherId));
  const state: FriendsState = { friends: [], incoming: [], outgoing: [], friendshipByUser: {} };
  for (const f of rows) {
    const profile = profiles[otherId(f)];
    if (!profile) continue;
    state.friendshipByUser[profile.id] = f;
    if (f.status === 'accepted') state.friends.push(profile);
    else if (f.addressee_id === me) state.incoming.push({ friendship: f, profile });
    else state.outgoing.push({ friendship: f, profile });
  }
  state.friends.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
  return state;
}

export async function sendFriendRequest(userId: string) {
  const me = await uid();
  check(await supabase.from('friendships').insert({ requester_id: me, addressee_id: userId }));
}

export async function acceptFriendRequest(friendshipId: string) {
  check(await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId));
}

export async function removeFriendship(friendshipId: string) {
  check(await supabase.from('friendships').delete().eq('id', friendshipId));
}

// ─── Circles ─────────────────────────────────────────────────
export async function getMyCircles(): Promise<(Circle & { memberIds: string[] })[]> {
  const me = await uid();
  const circles = check(await supabase.from('circles').select('*').eq('owner_id', me).order('created_at')) as Circle[];
  if (circles.length === 0) return [];
  const members = check(
    await supabase.from('circle_members').select('circle_id, member_id').in('circle_id', circles.map((c) => c.id)),
  ) as { circle_id: string; member_id: string }[];
  return circles.map((c) => ({ ...c, memberIds: members.filter((m) => m.circle_id === c.id).map((m) => m.member_id) }));
}

export async function createCircle(name: string, emoji: string, memberIds: string[]) {
  const me = await uid();
  const circle = check(
    await supabase.from('circles').insert({ owner_id: me, name, emoji }).select().single(),
  ) as Circle;
  if (memberIds.length) {
    check(await supabase.from('circle_members').insert(memberIds.map((member_id) => ({ circle_id: circle.id, member_id }))));
  }
  return circle;
}

export async function deleteCircle(id: string) {
  check(await supabase.from('circles').delete().eq('id', id));
}

// ─── Availability ────────────────────────────────────────────
export async function getMyRules(): Promise<AvailabilityRule[]> {
  const me = await uid();
  return check(
    await supabase.from('availability_rules').select('*').eq('user_id', me).order('weekday').order('start_minute'),
  ) as AvailabilityRule[];
}

export async function addRules(rules: Pick<AvailabilityRule, 'weekday' | 'start_minute' | 'end_minute'>[]) {
  const me = await uid();
  check(await supabase.from('availability_rules').insert(rules.map((r) => ({ ...r, user_id: me }))));
}

export async function deleteRule(id: string) {
  check(await supabase.from('availability_rules').delete().eq('id', id));
}

export async function getMyFreeSlots(): Promise<FreeSlot[]> {
  const me = await uid();
  return check(
    await supabase
      .from('free_slots')
      .select('*')
      .eq('user_id', me)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at'),
  ) as FreeSlot[];
}

export async function addFreeSlot(startsAt: string, endsAt: string, note = '') {
  const me = await uid();
  check(await supabase.from('free_slots').insert({ user_id: me, starts_at: startsAt, ends_at: endsAt, note }));
}

export async function deleteFreeSlot(id: string) {
  check(await supabase.from('free_slots').delete().eq('id', id));
}

/** Load everything needed to compute free time for a set of users (RLS limits this to friends). */
export async function getAvailability(
  userIds: string[],
  range: { start: number; end: number },
): Promise<Record<string, UserAvailability>> {
  if (userIds.length === 0) return {};
  const from = new Date(range.start).toISOString();
  const to = new Date(range.end).toISOString();
  const [profiles, rules, free, busy] = await Promise.all([
    getProfiles(userIds),
    supabase.from('availability_rules').select('user_id, weekday, start_minute, end_minute').in('user_id', userIds),
    supabase.from('free_slots').select('user_id, starts_at, ends_at').in('user_id', userIds).lt('starts_at', to).gt('ends_at', from),
    supabase.from('busy_blocks').select('user_id, starts_at, ends_at').in('user_id', userIds).lt('starts_at', to).gt('ends_at', from),
  ]);
  const out: Record<string, UserAvailability> = {};
  for (const id of userIds) {
    out[id] = { timezone: profiles[id]?.timezone ?? 'UTC', rules: [], freeSlots: [], busy: [] };
  }
  for (const r of check(rules) ?? []) out[r.user_id]?.rules.push(r);
  for (const f of check(free) ?? []) out[f.user_id]?.freeSlots.push(f);
  for (const b of check(busy) ?? []) out[b.user_id]?.busy.push(b);
  return out;
}

// ─── Activities ──────────────────────────────────────────────
export type ActivityWithPeople = Activity & { members: ActivityMember[] };

export async function listUpcomingActivities(): Promise<ActivityWithPeople[]> {
  const rows = check(
    await supabase
      .from('activities')
      .select('*, members:activity_members(*)')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(50),
  ) as ActivityWithPeople[];
  return rows;
}

export async function listActivitiesBetween(from: number, to: number): Promise<ActivityWithPeople[]> {
  return check(
    await supabase
      .from('activities')
      .select('*, members:activity_members(*)')
      .lt('starts_at', new Date(to).toISOString())
      .gt('ends_at', new Date(from).toISOString())
      .order('starts_at')
      .limit(200),
  ) as ActivityWithPeople[];
}

export async function getActivity(id: string): Promise<ActivityWithPeople | null> {
  return check(
    await supabase.from('activities').select('*, members:activity_members(*)').eq('id', id).maybeSingle(),
  ) as ActivityWithPeople | null;
}

export type NewActivity = Pick<
  Activity,
  'title' | 'emoji' | 'details' | 'location' | 'starts_at' | 'ends_at' | 'visibility' | 'circle_id'
>;

export async function createActivity(input: NewActivity, inviteeIds: string[] = []): Promise<Activity> {
  const me = await uid();
  const activity = check(
    await supabase.from('activities').insert({ ...input, host_id: me }).select().single(),
  ) as Activity;
  if (input.visibility === 'invite' && inviteeIds.length) {
    check(
      await supabase
        .from('activity_invitees')
        .insert(inviteeIds.map((user_id) => ({ activity_id: activity.id, user_id }))),
    );
  }
  return activity;
}

export async function deleteActivity(id: string) {
  check(await supabase.from('activities').delete().eq('id', id));
}

export async function setRsvp(activityId: string, status: 'going' | 'maybe' | null) {
  const me = await uid();
  if (status === null) {
    check(await supabase.from('activity_members').delete().eq('activity_id', activityId).eq('user_id', me));
  } else {
    check(await supabase.from('activity_members').upsert({ activity_id: activityId, user_id: me, status }));
  }
}

// ─── Pings ───────────────────────────────────────────────────
export async function listActivePings(): Promise<Ping[]> {
  return check(
    await supabase
      .from('pings')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ) as Ping[];
}

export async function getPing(id: string): Promise<Ping | null> {
  return check(await supabase.from('pings').select('*').eq('id', id).maybeSingle()) as Ping | null;
}

export type NewPing = Pick<Ping, 'message' | 'gif_url' | 'sticker' | 'starts_at' | 'ends_at' | 'visibility' | 'circle_id' | 'activity_id'> & {
  expires_at?: string;
};

/** Create a ping and push-notify friends. */
export async function sendPing(input: NewPing): Promise<{ ping: Ping; notified: number | null }> {
  const me = await uid();
  const ping = check(await supabase.from('pings').insert({ ...input, sender_id: me }).select().single()) as Ping;
  let notified: number | null = null;
  try {
    const { data } = await supabase.functions.invoke('send-ping', { body: { ping_id: ping.id } });
    notified = data?.sent ?? null;
  } catch {
    // Push is best-effort; the ping is still visible in-app.
  }
  return { ping, notified };
}

export async function deletePing(id: string) {
  check(await supabase.from('pings').delete().eq('id', id));
}

export async function getPingResponses(pingId: string): Promise<PingResponse[]> {
  return check(await supabase.from('ping_responses').select('*').eq('ping_id', pingId)) as PingResponse[];
}

export async function respondToPing(pingId: string, response: 'in' | 'maybe' | null) {
  const me = await uid();
  if (response === null) {
    check(await supabase.from('ping_responses').delete().eq('ping_id', pingId).eq('user_id', me));
  } else {
    check(await supabase.from('ping_responses').upsert({ ping_id: pingId, user_id: me, response }));
  }
}

export async function markPingViewed(pingId: string) {
  const me = await uid();
  await supabase.from('ping_views').upsert({ ping_id: pingId, viewer_id: me }, { ignoreDuplicates: true });
}

export async function getViewedPingIds(): Promise<Set<string>> {
  const me = await uid();
  const rows = check(await supabase.from('ping_views').select('ping_id').eq('viewer_id', me)) as { ping_id: string }[];
  return new Set(rows.map((r) => r.ping_id));
}

// ─── Nudges ──────────────────────────────────────────────────
export async function nudgeFriend(friendId: string, label: string) {
  const { data, error } = await supabase.functions.invoke('nudge', { body: { friend_id: friendId, label } });
  if (error) throw new Error(error.message);
  return data as { sent: number };
}
