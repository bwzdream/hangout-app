-- "Meet people nearby" (public mode)
--
-- People can opt in to share some free time publicly. Others who are also public and
-- nearby can see those times and send a hangout request; if accepted, a private
-- hangout is created for the two of them.
--
-- Rules enforced here (not just in the app):
--   * You must be public yourself to see anyone else.
--   * Locations are stored rounded to ~1 km (2 decimal places).
--   * Free plan: at most 120 minutes of public time per local day (several slots add up).
--     The 'plus' plan (paywall, later) removes the limit.
--   * Blocking hides people from each other and stops requests both ways.

-- ── Who is public, and roughly where ────────────────────────────────────────
create table public.public_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  lat numeric(5, 2) check (lat between -90 and 90),
  lng numeric(5, 2) check (lng between -180 and 180),
  radius_km smallint not null default 10 check (radius_km between 1 and 100),
  updated_at timestamptz not null default now()
);

-- Always round whatever the app sends, so exact positions are never stored.
create or replace function public.round_public_location()
returns trigger
language plpgsql
as $$
begin
  new.lat := round(new.lat, 2);
  new.lng := round(new.lng, 2);
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_public_profile_write
  before insert or update on public.public_profiles
  for each row execute function public.round_public_location();

-- ── Plans (paywall later). Only the server (service role) writes these. ──────
create table public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  expires_at timestamptz
);

create or replace function public.has_public_unlimited(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid and e.plan = 'plus' and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ── Blocking ────────────────────────────────────────────────────────────────
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ── Public free time ────────────────────────────────────────────────────────
create table public.public_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text not null default '' check (length(note) <= 100),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours')
);
create index public_slots_time_idx on public.public_slots (starts_at, ends_at);
create index public_slots_user_idx on public.public_slots (user_id, starts_at);

-- Minutes of public time a user has on the local day of `at` (optionally excluding one slot).
create or replace function public.public_minutes_on_day(uid uuid, at timestamptz, exclude_id uuid default null)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(extract(epoch from (s.ends_at - s.starts_at)) / 60), 0)::integer
  from public.public_slots s
  join public.profiles p on p.id = s.user_id
  where s.user_id = uid
    and (exclude_id is null or s.id <> exclude_id)
    and (s.starts_at at time zone p.timezone)::date = (at at time zone p.timezone)::date;
$$;

create or replace function public.enforce_public_slot_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  used integer;
  adding integer;
begin
  if not exists (select 1 from public.public_profiles where user_id = new.user_id and enabled) then
    raise exception 'public_mode_off' using hint = 'Turn on public mode first.';
  end if;
  if new.ends_at <= now() then
    raise exception 'public_slot_in_past';
  end if;
  if not public.has_public_unlimited(new.user_id) then
    used := public.public_minutes_on_day(new.user_id, new.starts_at, new.id);
    adding := ceil(extract(epoch from (new.ends_at - new.starts_at)) / 60);
    if used + adding > 120 then
      raise exception 'public_time_limit'
        using detail = format('%s minutes left that day', greatest(0, 120 - used)),
              hint = 'Free accounts can share 2 hours of public time per day.';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_public_slot_write
  before insert or update on public.public_slots
  for each row execute function public.enforce_public_slot_rules();

-- ── Hangout requests between public people ──────────────────────────────────
create table public.hangout_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid not null references public.public_slots (id) on delete cascade,
  message text not null default '' check (length(message) <= 140),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_user, slot_id),
  check (from_user <> to_user)
);
create index hangout_requests_to_idx on public.hangout_requests (to_user, status);

-- Can the caller request this slot?
create or replace function public.can_request_slot(sid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.public_slots s
    join public.public_profiles owner on owner.user_id = s.user_id and owner.enabled
    join public.public_profiles me on me.user_id = auth.uid() and me.enabled
    where s.id = sid
      and s.user_id <> auth.uid()
      and s.ends_at > now()
      and not public.is_blocked_between(auth.uid(), s.user_id)
  );
$$;

-- Fill in to_user from the slot; only allow the right person to make each status change;
-- when accepted, create a private hangout for the two of them.
create or replace function public.handle_hangout_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  slot public.public_slots;
  act_id uuid;
begin
  if tg_op = 'INSERT' then
    select * into slot from public.public_slots where id = new.slot_id;
    new.to_user := slot.user_id;
    new.status := 'pending';
    new.activity_id := null;
    return new;
  end if;

  -- UPDATE: nothing but the status may change.
  new.from_user := old.from_user;
  new.to_user := old.to_user;
  new.slot_id := old.slot_id;
  new.message := old.message;
  new.created_at := old.created_at;
  new.activity_id := old.activity_id;

  if new.status = old.status then
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'request_already_answered';
  end if;
  if new.status in ('accepted', 'declined') and auth.uid() is distinct from old.to_user then
    raise exception 'only_recipient_can_answer';
  end if;
  if new.status = 'cancelled' and auth.uid() is distinct from old.from_user then
    raise exception 'only_sender_can_cancel';
  end if;
  new.responded_at := now();

  if new.status = 'accepted' then
    select * into slot from public.public_slots where id = old.slot_id;
    insert into public.activities (host_id, title, emoji, starts_at, ends_at, visibility)
    values (old.to_user, coalesce(nullif(slot.note, ''), 'Hangout'), '👋', slot.starts_at, slot.ends_at, 'invite')
    returning id into act_id;
    insert into public.activity_invitees (activity_id, user_id) values (act_id, old.from_user) on conflict do nothing;
    insert into public.activity_members (activity_id, user_id, status) values (act_id, old.from_user, 'going') on conflict do nothing;
    new.activity_id := act_id;
  end if;
  return new;
end;
$$;

create trigger on_hangout_request_write
  before insert or update on public.hangout_requests
  for each row execute function public.handle_hangout_request();

-- ── Browse: public slots near me ────────────────────────────────────────────
create or replace function public.nearby_public_slots(p_from timestamptz, p_to timestamptz)
returns table (
  slot_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_emoji text,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  distance_km integer,
  overlaps_mine boolean,
  my_request text
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select pp.lat, pp.lng, pp.radius_km
    from public.public_profiles pp
    where pp.user_id = auth.uid() and pp.enabled and pp.lat is not null and pp.lng is not null
  ),
  candidates as (
    select s.*, p.username, p.display_name, p.avatar_emoji,
      -- haversine distance in km
      (6371 * acos(least(1, greatest(-1,
        cos(radians(me.lat)) * cos(radians(o.lat)) * cos(radians(o.lng) - radians(me.lng))
        + sin(radians(me.lat)) * sin(radians(o.lat))
      )))) as km,
      me.radius_km
    from me
    join public.public_profiles o on o.enabled and o.lat is not null and o.lng is not null and o.user_id <> auth.uid()
    join public.public_slots s on s.user_id = o.user_id
    join public.profiles p on p.id = o.user_id
    where s.ends_at > now()
      and s.starts_at < p_to and s.ends_at > p_from
      and not public.is_blocked_between(auth.uid(), o.user_id)
  )
  select c.id, c.user_id, c.username, c.display_name, c.avatar_emoji, c.starts_at, c.ends_at, c.note,
    greatest(1, ceil(c.km))::integer,
    exists (
      select 1 from public.public_slots mine
      where mine.user_id = auth.uid() and mine.starts_at < c.ends_at and mine.ends_at > c.starts_at
    ),
    (select r.status from public.hangout_requests r where r.from_user = auth.uid() and r.slot_id = c.id)
  from candidates c
  where c.km <= c.radius_km
  order by 10 desc, c.starts_at
  limit 100;
$$;

-- My requests (sent and received) with the slot's time — the slot itself is private to its owner.
create or replace function public.my_hangout_requests()
returns table (
  id uuid, from_user uuid, to_user uuid, slot_id uuid, message text, status text, activity_id uuid,
  created_at timestamptz, starts_at timestamptz, ends_at timestamptz, note text
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.from_user, r.to_user, r.slot_id, r.message, r.status, r.activity_id, r.created_at,
    s.starts_at, s.ends_at, s.note
  from public.hangout_requests r
  join public.public_slots s on s.id = r.slot_id
  where auth.uid() in (r.from_user, r.to_user)
  order by r.created_at desc
  limit 50;
$$;

-- Daily usage for the app's "1h 15m left today".
create or replace function public.my_public_status(p_day_of timestamptz default now())
returns table (enabled boolean, has_location boolean, radius_km smallint, used_minutes integer, limit_minutes integer)
language sql stable security definer set search_path = public
as $$
  select
    coalesce(pp.enabled, false),
    pp.lat is not null,
    coalesce(pp.radius_km, 10::smallint),
    public.public_minutes_on_day(auth.uid(), p_day_of),
    case when public.has_public_unlimited(auth.uid()) then null else 120 end
  from (select auth.uid() as uid) u
  left join public.public_profiles pp on pp.user_id = u.uid;
$$;

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.public_profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.blocks enable row level security;
alter table public.public_slots enable row level security;
alter table public.hangout_requests enable row level security;

create policy "public profile own" on public.public_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entitlements own read" on public.entitlements for select to authenticated
  using (user_id = auth.uid());

create policy "blocks own" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Your own slots directly; everyone else's only through nearby_public_slots().
create policy "public slots own" on public.public_slots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "requests participants read" on public.hangout_requests for select to authenticated
  using (auth.uid() in (from_user, to_user));
create policy "requests send" on public.hangout_requests for insert to authenticated
  with check (from_user = auth.uid() and public.can_request_slot(slot_id));
create policy "requests answer or cancel" on public.hangout_requests for update to authenticated
  using (auth.uid() in (from_user, to_user)) with check (auth.uid() in (from_user, to_user));

-- Function permissions: no anonymous access; triggers aren't callable directly.
revoke execute on function public.has_public_unlimited(uuid), public.is_blocked_between(uuid, uuid),
  public.public_minutes_on_day(uuid, timestamptz, uuid), public.can_request_slot(uuid),
  public.nearby_public_slots(timestamptz, timestamptz), public.my_public_status(timestamptz), public.my_hangout_requests(),
  public.enforce_public_slot_rules(), public.handle_hangout_request(), public.round_public_location()
from public, anon;
revoke execute on function public.enforce_public_slot_rules(), public.handle_hangout_request(), public.round_public_location(),
  public.public_minutes_on_day(uuid, timestamptz, uuid)
from authenticated;
grant execute on function public.has_public_unlimited(uuid), public.is_blocked_between(uuid, uuid),
  public.can_request_slot(uuid), public.nearby_public_slots(timestamptz, timestamptz), public.my_public_status(timestamptz),
  public.my_hangout_requests()
to authenticated;

alter publication supabase_realtime add table public.hangout_requests;
