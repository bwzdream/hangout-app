-- Pingle v1 schema
-- Privacy principle: we only store busy *times* from calendars, never event titles.


-- ─────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_emoji text not null default '😎',
  bio text not null default '',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Push tokens are private: only the owner (and service role) can read them.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'unknown',
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username',
                                        split_part(new.email, '@', 1), 'user'),
                               '[^a-zA-Z0-9_]', '', 'g'));
  if length(base) < 3 then base := base || 'pal'; end if;
  base := left(base, 16);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, timezone)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'display_name', candidate),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Friends & circles
-- ─────────────────────────────────────────────────────────────
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
-- One friendship per pair regardless of direction.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.is_friend(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = other)
        or (f.addressee_id = auth.uid() and f.requester_id = other))
  );
$$;

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  emoji text not null default '✨',
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  primary key (circle_id, member_id)
);

create or replace function public.owns_circle(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.circles c where c.id = cid and c.owner_id = auth.uid());
$$;

create or replace function public.in_circle(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.circle_members m where m.circle_id = cid and m.member_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────
-- Availability
-- ─────────────────────────────────────────────────────────────
-- Recurring weekly free time, in the owner's local time zone.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);

-- One-off free windows ("I'm free Saturday 2-6").
create table public.free_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Busy times pulled from the user's calendars (no titles, ever).
create table public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'device',
  check (ends_at > starts_at)
);
create index busy_blocks_user_time_idx on public.busy_blocks (user_id, starts_at);
create index free_slots_user_time_idx on public.free_slots (user_id, starts_at);

-- ─────────────────────────────────────────────────────────────
-- Activities
-- ─────────────────────────────────────────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  emoji text not null default '🎉',
  details text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visibility text not null default 'friends' check (visibility in ('friends', 'circle', 'invite')),
  circle_id uuid references public.circles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index activities_time_idx on public.activities (starts_at);

create table public.activity_invitees (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (activity_id, user_id)
);

create table public.activity_members (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create or replace function public.can_view_activity(aid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.activities a
    where a.id = aid
      and (
        a.host_id = auth.uid()
        or exists (select 1 from public.activity_members m where m.activity_id = a.id and m.user_id = auth.uid())
        or exists (select 1 from public.activity_invitees i where i.activity_id = a.id and i.user_id = auth.uid())
        or (a.visibility = 'friends' and public.is_friend(a.host_id))
        or (a.visibility = 'circle' and a.circle_id is not null
            and public.is_friend(a.host_id) and public.in_circle(a.circle_id))
      )
  );
$$;

-- Joined or invited (looks only at the join tables, so it's safe inside the activities policy).
create or replace function public.is_activity_participant(aid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.activity_members m where m.activity_id = aid and m.user_id = auth.uid())
      or exists (select 1 from public.activity_invitees i where i.activity_id = aid and i.user_id = auth.uid());
$$;

create or replace function public.is_activity_host(aid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.activities a where a.id = aid and a.host_id = auth.uid());
$$;

-- Host automatically "goes" to their own activity.
create or replace function public.add_host_as_member()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.activity_members (activity_id, user_id, status)
  values (new.id, new.host_id, 'going')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_activity_created
  after insert on public.activities
  for each row execute function public.add_host_as_member();

-- ─────────────────────────────────────────────────────────────
-- Pings: short-lived "I'm free!" posts, like stories.
-- ─────────────────────────────────────────────────────────────
create table public.pings (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '' check (length(message) <= 140),
  gif_url text,
  sticker text, -- emoji sticker fallback when there's no GIF
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  activity_id uuid references public.activities (id) on delete set null,
  visibility text not null default 'friends' check (visibility in ('friends', 'circle')),
  circle_id uuid references public.circles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index pings_expiry_idx on public.pings (expires_at);

create or replace function public.can_view_ping(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.pings p
    where p.id = pid
      and (
        p.sender_id = auth.uid()
        or (
          p.expires_at > now()
          and public.is_friend(p.sender_id)
          and (p.visibility = 'friends'
               or (p.visibility = 'circle' and p.circle_id is not null and public.in_circle(p.circle_id)))
        )
      )
  );
$$;

create table public.ping_responses (
  ping_id uuid not null references public.pings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null default 'in' check (response in ('in', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (ping_id, user_id)
);

create table public.ping_views (
  ping_id uuid not null references public.pings (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (ping_id, viewer_id)
);

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.friendships enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.availability_rules enable row level security;
alter table public.free_slots enable row level security;
alter table public.busy_blocks enable row level security;
alter table public.activities enable row level security;
alter table public.activity_invitees enable row level security;
alter table public.activity_members enable row level security;
alter table public.pings enable row level security;
alter table public.ping_responses enable row level security;
alter table public.ping_views enable row level security;

-- Profiles: any signed-in user can look people up (to add friends); only you edit yours.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "push tokens own" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Friendships
create policy "friendships visible to both" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());
create policy "friendships remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Circles
create policy "circles owner or member read" on public.circles for select to authenticated
  using (owner_id = auth.uid() or public.in_circle(id));
create policy "circles owner write" on public.circles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "circle members read" on public.circle_members for select to authenticated
  using (public.owns_circle(circle_id) or member_id = auth.uid());
create policy "circle members owner write" on public.circle_members for insert to authenticated
  with check (public.owns_circle(circle_id) and public.is_friend(member_id));
create policy "circle members owner delete" on public.circle_members for delete to authenticated
  using (public.owns_circle(circle_id));

-- Availability: you and your friends can see it; only you change it.
create policy "rules read" on public.availability_rules for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id));
create policy "rules write" on public.availability_rules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "free read" on public.free_slots for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id));
create policy "free write" on public.free_slots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "busy read" on public.busy_blocks for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id));
create policy "busy write" on public.busy_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Activities
-- Checks the row's own columns (not a lookup by id) so INSERT ... RETURNING works.
create policy "activities read" on public.activities for select to authenticated
  using (
    host_id = auth.uid()
    or (visibility = 'friends' and public.is_friend(host_id))
    or (visibility = 'circle' and circle_id is not null and public.is_friend(host_id) and public.in_circle(circle_id))
    or public.is_activity_participant(id)
  );
create policy "activities create" on public.activities for insert to authenticated
  with check (host_id = auth.uid() and (circle_id is null or public.owns_circle(circle_id)));
create policy "activities host update" on public.activities for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "activities host delete" on public.activities for delete to authenticated
  using (host_id = auth.uid());

create policy "invitees read" on public.activity_invitees for select to authenticated
  using (user_id = auth.uid() or public.is_activity_host(activity_id));
create policy "invitees host write" on public.activity_invitees for insert to authenticated
  with check (public.is_activity_host(activity_id) and public.is_friend(user_id));
create policy "invitees host delete" on public.activity_invitees for delete to authenticated
  using (public.is_activity_host(activity_id));

create policy "members read" on public.activity_members for select to authenticated
  using (public.can_view_activity(activity_id));
create policy "members join" on public.activity_members for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_activity(activity_id));
create policy "members update self" on public.activity_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members leave" on public.activity_members for delete to authenticated
  using (user_id = auth.uid() or public.is_activity_host(activity_id));

-- Pings
create policy "pings read" on public.pings for select to authenticated
  using (
    sender_id = auth.uid()
    or (
      expires_at > now()
      and public.is_friend(sender_id)
      and (visibility = 'friends' or (visibility = 'circle' and circle_id is not null and public.in_circle(circle_id)))
    )
  );
create policy "pings create" on public.pings for insert to authenticated
  with check (sender_id = auth.uid() and (circle_id is null or public.owns_circle(circle_id)));
create policy "pings sender delete" on public.pings for delete to authenticated
  using (sender_id = auth.uid());

create policy "ping responses read" on public.ping_responses for select to authenticated
  using (public.can_view_ping(ping_id));
create policy "ping responses write" on public.ping_responses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_view_ping(ping_id));

create policy "ping views read" on public.ping_views for select to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from public.pings p where p.id = ping_id and p.sender_id = auth.uid()));
create policy "ping views write" on public.ping_views for insert to authenticated
  with check (viewer_id = auth.uid() and public.can_view_ping(ping_id));

-- Realtime: stream new pings & RSVPs to the app.
alter publication supabase_realtime add table public.pings;
alter publication supabase_realtime add table public.activity_members;
alter publication supabase_realtime add table public.ping_responses;
