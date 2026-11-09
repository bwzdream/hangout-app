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

console.log('\nAll RLS checks passed 🎉');
