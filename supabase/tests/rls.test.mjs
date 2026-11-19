// Verifies the Pingle migration + RLS policies on PGlite (in-process Postgres) with a stubbed Supabase auth layer.
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../migrations/', import.meta.url);
const migration = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .join('\n');
const db = new PGlite();

await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`);
await db.exec(migration);
console.log('✓ migration applied');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
   ('${A}', 'alex@x.com', '{"username":"alex","display_name":"Alex"}'),
   ('${B}', 'sam@x.com',  '{"display_name":"Sam"}'),
   ('${C}', 'alex@y.com', '{"username":"alex"}');
`);
const profiles = (await db.query('select id, username, display_name from public.profiles order by id')).rows;
assert.deepEqual(profiles.map((p) => p.username), ['alex', 'sam', 'alex1']);
console.log('✓ signup trigger creates profiles with unique usernames', profiles.map((p) => p.username));

/** Run SQL as a signed-in user. */
async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
}
async function fails(uid, sql) {
  try {
    await as(uid, sql);
  } catch {
    return true;
  }
  return false;
}

// Friendships
await as(A, `insert into friendships (requester_id, addressee_id) values ('${A}', '${B}')`);
assert.ok(await fails(A, `insert into friendships (requester_id, addressee_id) values ('${B}', '${A}')`), 'duplicate pair blocked');
assert.ok(await fails(C, `insert into friendships (requester_id, addressee_id, status) values ('${C}', '${A}', 'accepted')`), 'cannot self-accept');
// A cannot accept their own request; B can.
await as(A, `update friendships set status='accepted'`);
assert.equal((await as(B, `select status from friendships`))[0].status, 'pending');
await as(B, `update friendships set status='accepted'`);
assert.equal((await as(A, `select status from friendships`))[0].status, 'accepted');
assert.equal((await as(C, `select * from friendships`)).length, 0);
console.log('✓ friend requests: only the addressee can accept; strangers see nothing');

// Availability visible to friends only
await as(A, `insert into availability_rules (user_id, weekday, start_minute, end_minute) values ('${A}', 5, 1080, 1320)`);
await as(A, `insert into busy_blocks (user_id, starts_at, ends_at) values ('${A}', now(), now() + interval '1 hour')`);
assert.equal((await as(B, `select * from availability_rules`)).length, 1);
assert.equal((await as(B, `select * from busy_blocks`)).length, 1);
assert.equal((await as(C, `select * from availability_rules`)).length, 0);
assert.equal((await as(C, `select * from busy_blocks`)).length, 0);
assert.ok(await fails(B, `insert into availability_rules (user_id, weekday, start_minute, end_minute) values ('${A}', 1, 0, 60)`));
console.log('✓ availability: friends can read, strangers cannot, nobody writes yours');

// Push tokens are private
await as(A, `insert into push_tokens (token, user_id) values ('ExponentPushToken[a]', '${A}')`);
assert.equal((await as(B, `select * from push_tokens`)).length, 0);
console.log('✓ push tokens private');

// Circles + activities visibility
const [circle] = await as(A, `insert into circles (owner_id, name) values ('${A}', 'Close') returning id`);
assert.ok(await fails(A, `insert into circle_members (circle_id, member_id) values ('${circle.id}', '${C}')`), 'cannot add non-friend');
const ins = (vis, extra = 'null') =>
  as(A, `insert into activities (host_id, title, starts_at, ends_at, visibility, circle_id)
         values ('${A}', '${vis}', now() + interval '1 day', now() + interval '1 day 2 hours', '${vis}', ${extra}) returning id`);
const [actFriends] = await ins('friends');
const [actCircle] = await ins('circle', `'${circle.id}'`);
const [actInvite] = await ins('invite');

const seen = async (uid) => (await as(uid, `select title from activities order by title`)).map((r) => r.title);
assert.deepEqual(await seen(A), ['circle', 'friends', 'invite']);
assert.deepEqual(await seen(B), ['friends']);
assert.deepEqual(await seen(C), []);

await as(A, `insert into circle_members (circle_id, member_id) values ('${circle.id}', '${B}')`);
await as(A, `insert into activity_invitees (activity_id, user_id) values ('${actInvite.id}', '${B}')`);
assert.deepEqual(await seen(B), ['circle', 'friends', 'invite']);
console.log('✓ activity visibility: friends / circle / invite-only all enforced');

// Host auto-joins; RSVPs
const members = await as(B, `select user_id, status from activity_members where activity_id = '${actFriends.id}'`);
assert.deepEqual(members, [{ user_id: A, status: 'going' }]);
await as(B, `insert into activity_members (activity_id, user_id) values ('${actFriends.id}', '${B}')`);
assert.ok(await fails(C, `insert into activity_members (activity_id, user_id) values ('${actFriends.id}', '${C}')`), 'stranger cannot join');
assert.ok(await fails(B, `insert into activity_members (activity_id, user_id) values ('${actCircle.id}', '${C}')`), 'cannot RSVP for others');
await as(B, `update activities set title = 'hacked'`); // RLS: silently affects 0 rows
assert.ok(!(await seen(A)).includes('hacked'));
console.log('✓ RSVPs: host auto-going, friends can join, strangers cannot, only host edits');

// Pings: visible to friends until they expire
await as(A, `insert into pings (sender_id, message, starts_at, ends_at) values ('${A}', 'tacos?', now(), now() + interval '2 hours')`);
await as(A, `insert into pings (sender_id, message, starts_at, ends_at, expires_at) values ('${A}', 'old', now() - interval '3 hours', now() - interval '1 hour', now() - interval '1 minute')`);
assert.deepEqual((await as(B, `select message from pings`)).map((r) => r.message), ['tacos?']);
assert.equal((await as(A, `select * from pings`)).length, 2, 'sender still sees own expired pings');
assert.equal((await as(C, `select * from pings`)).length, 0);
const [p] = await as(B, `select id from pings`);
await as(B, `insert into ping_responses (ping_id, user_id) values ('${p.id}', '${B}')`);
await as(B, `insert into ping_views (ping_id, viewer_id) values ('${p.id}', '${B}')`);
assert.equal((await as(A, `select * from ping_responses`)).length, 1);
assert.equal((await as(A, `select * from ping_views`)).length, 1);
assert.ok(await fails(C, `insert into ping_responses (ping_id, user_id) values ('${p.id}', '${C}')`));
console.log('✓ pings: friends see them until expiry, strangers never; responses & views work');

// Unfriending hides everything
await as(B, `delete from friendships`);
assert.deepEqual(await seen(B), ['friends', 'invite']); // joined + invited stay; circle one disappears
assert.equal((await as(B, `select * from availability_rules`)).length, 0);
assert.equal((await as(B, `select * from pings`)).length, 0);
console.log('✓ unfriending removes access to availability & pings (joined/invited activities stay visible)');

// Contact matching
const { createHash } = await import('node:crypto');
const h = (v) => createHash('sha256').update(v).digest('hex');
assert.equal((await as(A, `select * from contact_hashes`)).length, 1, 'own email hash only');
const bEmail = h('email:sam@x.com');
let m = await as(A, `select id, kind, verified from match_contacts(array['${bEmail}', '${h('email:nobody@x.com')}'])`);
assert.deepEqual(m, [{ id: B, kind: 'email', verified: true }]);
assert.equal((await as(A, `select * from match_contacts(array['${h('email:alex@x.com')}'])`)).length, 0, 'never matches yourself');
assert.ok(await fails(A, `insert into contact_hashes (user_id, kind, hash) values ('${A}', 'email', '${h('email:sam@x.com')}')`), 'cannot claim an email');
assert.ok(await fails(A, `insert into contact_hashes (user_id, kind, hash) values ('${B}', 'phone', '${h('phone:15551234567')}')`), 'cannot add for others');
await as(A, `insert into contact_hashes (user_id, kind, hash) values ('${A}', 'phone', '${h('phone:15551234567')}')`);
m = await as(B, `select id, kind, verified from match_contacts(array['${h('phone:15551234567')}'])`);
assert.deepEqual(m, [{ id: A, kind: 'phone', verified: false }]);
assert.equal((await as(B, `select * from contact_hashes`)).length, 1, 'cannot read other users hashes');
console.log('✓ contact matching: hashed emails/phones match, never yourself, no reading others, no claiming emails');

// ── Public mode ──
const tomorrow = `(date_trunc('day', now()) + interval '1 day 18 hours')`;
assert.ok(await fails(C, `insert into public_slots (user_id, starts_at, ends_at) values ('${C}', ${tomorrow}, ${tomorrow} + interval '1 hour')`), 'must be public to post');
assert.ok(await fails(A, `insert into public_profiles (user_id, lat, lng) values ('${A}', 37.77, -122.42)`), 'needs a birthdate');
assert.ok(await fails(A, `insert into public_profiles (user_id, lat, lng, birthdate) values ('${A}', 37.77, -122.42, current_date - interval '17 years')`), 'must be 18+');
await as(A, `insert into public_profiles (user_id, lat, lng, radius_km, birthdate, gender, interests, looking_for) values ('${A}', 37.774929, -122.419416, 10, current_date - interval '30 years', 'man', '{hiking,coffee,games}', '{friends,activity}')`);
assert.deepEqual((await as(A, `select lat::text, lng::text from public_profiles`))[0], { lat: '37.77', lng: '-122.42' });
await as(A, `insert into public_slots (user_id, starts_at, ends_at, note) values ('${A}', ${tomorrow}, ${tomorrow} + interval '90 minutes', 'Tacos?')`);
assert.ok(await fails(A, `insert into public_slots (user_id, starts_at, ends_at) values ('${A}', ${tomorrow} + interval '3 hours', ${tomorrow} + interval '3 hours 45 minutes')`), '2h/day limit');
await as(A, `insert into public_slots (user_id, starts_at, ends_at) values ('${A}', ${tomorrow} + interval '3 hours', ${tomorrow} + interval '3 hours 30 minutes')`);
assert.equal((await as(A, `select used_minutes, limit_minutes from my_public_status(${tomorrow})`))[0].used_minutes, 120);
await db.exec(`insert into entitlements (user_id, plan) values ('${A}', 'plus')`);
await as(A, `insert into public_slots (user_id, starts_at, ends_at) values ('${A}', ${tomorrow} + interval '4 hours', ${tomorrow} + interval '5 hours')`);
assert.equal((await as(A, `select limit_minutes from my_public_status()`))[0].limit_minutes, null);
await db.exec(`delete from entitlements`);
console.log('✓ public mode: must opt in, location rounded, 2h/day limit, plus plan unlimited');

assert.equal((await as(B, `select * from nearby_public_slots(now(), now() + interval '7 days')`)).length, 0, 'not public → sees nothing');
await as(C, `insert into public_profiles (user_id, lat, lng, birthdate, gender, sexuality, show_sexuality, interests, looking_for) values ('${C}', 37.78, -122.41, current_date - interval '28 years', 'woman', 'bisexual', true, '{coffee,music,games}', '{friends}')`);
await as(B, `insert into public_profiles (user_id, lat, lng, birthdate) values ('${B}', 40.71, -74.00, current_date - interval '40 years')`);
await as(C, `insert into public_slots (user_id, starts_at, ends_at) values ('${C}', ${tomorrow} + interval '30 minutes', ${tomorrow} + interval '2 hours')`);
let near = await as(C, `select user_id, note, distance_km, overlaps_mine from nearby_public_slots(now(), now() + interval '7 days') order by starts_at`);
assert.ok(near.length >= 3 && near.every((r) => r.user_id === A), 'sees nearby A only');
assert.equal(near[0].note, 'Tacos?');
assert.equal(near[0].overlaps_mine, true);
assert.ok(near[0].distance_km <= 2);
assert.equal((await as(B, `select * from nearby_public_slots(now(), now() + interval '7 days')`)).length, 0, 'far away → nothing');
assert.equal((await as(C, `select * from public_slots where user_id = '${A}'`)).length, 0, 'no direct reading of others slots');
console.log('✓ nearby: only public people within radius, overlap flagged, no direct table access');

// Mutual matching
const nearA = async () => (await as(C, `select age, gender, sexuality, shared_interests from nearby_public_slots(now(), now() + interval '7 days')`));
let matchRows = await nearA();
assert.equal(matchRows[0].age, 30);
assert.deepEqual([...matchRows[0].shared_interests].sort(), ["coffee", "games"]);
assert.equal(matchRows[0].sexuality, null, 'A did not choose to show sexuality');
const cSeesA = await as(A, `select sexuality from nearby_public_slots(now(), now() + interval '7 days')`);
assert.equal(cSeesA[0].sexuality, 'bisexual', 'shown when chosen');
await as(C, `update public_profiles set pref_genders = '{woman}' where user_id = '${C}'`);
assert.equal((await nearA()).length, 0, 'C only wants to meet women → A hidden');
assert.equal((await as(A, `select * from nearby_public_slots(now(), now() + interval '7 days')`)).length, 0, 'and hidden both ways');
await as(C, `update public_profiles set pref_genders = '{}' where user_id = '${C}'`);
await as(A, `update public_profiles set pref_age_min = 35 where user_id = '${A}'`);
assert.equal((await nearA()).length, 0, 'C (28) is outside A’s age range → hidden for C too');
await as(A, `update public_profiles set pref_age_min = 18 where user_id = '${A}'`);
await as(C, `update public_profiles set looking_for = '{dating}' where user_id = '${C}'`);
assert.equal((await nearA()).length, 0, 'dating vs friends/activity → no match');
await as(A, `update public_profiles set looking_for = '{friends,dating}' where user_id = '${A}'`);
assert.ok((await nearA()).length > 0, 'both want dating → match');
await as(C, `update public_profiles set looking_for = '{friends}' where user_id = '${C}'`);
console.log('✓ matching: age, gender and looking-for apply both ways; shared interests; sexuality only if shown; 18+ only');

const [slot] = await as(A, `select id from public_slots where note = 'Tacos?'`);
await as(C, `insert into hangout_requests (from_user, to_user, slot_id, message) values ('${C}', '${C}', '${slot.id}', 'Down!')`);
const [req] = await as(A, `select id, to_user, from_user, status from hangout_requests`);
assert.equal(req.to_user, A, 'recipient filled from slot');
assert.ok(await fails(C, `update hangout_requests set status = 'accepted' where id = '${req.id}'`), 'sender cannot accept');
await as(A, `update hangout_requests set status = 'accepted' where id = '${req.id}'`);
const [acc] = await as(C, `select status, activity_id from hangout_requests where id = '${req.id}'`);
assert.equal(acc.status, 'accepted');
assert.ok(acc.activity_id, 'hangout created');
assert.equal((await as(C, `select title from activities where id = '${acc.activity_id}'`))[0].title, 'Tacos?');
assert.equal((await as(A, `select count(*)::int as n from activity_members where activity_id = '${acc.activity_id}'`))[0].n, 2);
assert.ok(await fails(A, `update hangout_requests set status = 'declined' where id = '${req.id}'`), 'cannot re-answer');
assert.equal((await as(C, `select note from my_hangout_requests()`))[0].note, 'Tacos?', 'sender sees slot time via my_hangout_requests');
assert.equal((await as(B, `select * from my_hangout_requests()`)).length, 0, 'others see nothing');
console.log('✓ requests: recipient answers, accept creates a private hangout for both');

await as(A, `insert into blocks (blocker_id, blocked_id) values ('${A}', '${C}')`);
assert.equal((await as(C, `select * from nearby_public_slots(now(), now() + interval '7 days')`)).length, 0, 'blocked → hidden');
const [slot2] = await as(A, `select id from public_slots where note = '' order by starts_at limit 1`);
assert.ok(await fails(C, `insert into hangout_requests (from_user, to_user, slot_id) values ('${C}', '${A}', '${slot2.id}')`), 'blocked → cannot request');
console.log('✓ blocking hides people and stops requests');

console.log('\nAll RLS checks passed 🎉');
