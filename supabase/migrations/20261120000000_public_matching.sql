-- Public profiles & mutual matching for "Meet people nearby".
--
-- About you:   birthdate (18+ to go public), gender, sexuality (optional, shown only if
--              you choose), interests, what you're looking for.
-- Preferences: age range, genders you'd like to meet.
-- Matching is mutual: you see someone only if they fit your preferences AND you fit
-- theirs, and your "looking for" choices overlap (when both have picked some).

alter table public.public_profiles
  add column birthdate date,
  add column gender text check (gender in ('woman', 'man', 'nonbinary', 'another')),
  add column sexuality text check (sexuality in ('straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'queer', 'asexual', 'questioning')),
  add column show_sexuality boolean not null default false,
  add column interests text[] not null default '{}' check (cardinality(interests) <= 12),
  add column looking_for text[] not null default '{}'
    check (looking_for <@ array['friends', 'activity', 'dating', 'networking']),
  add column pref_age_min smallint not null default 18 check (pref_age_min between 18 and 99),
  add column pref_age_max smallint not null default 99 check (pref_age_max between 18 and 99),
  add column pref_genders text[] not null default '{}'
    check (pref_genders <@ array['woman', 'man', 'nonbinary', 'another']),
  add constraint pref_age_order check (pref_age_min <= pref_age_max);

create or replace function public.years_old(b date)
returns integer
language sql immutable
as $$
  select extract(year from age(current_date, b))::integer;
$$;

-- Must be 18+ (with a birthdate) to be public.
create or replace function public.enforce_public_age()
returns trigger
language plpgsql
as $$
begin
  if new.enabled and (new.birthdate is null or public.years_old(new.birthdate) < 18) then
    raise exception 'must_be_18' using hint = 'You need to be 18 or older to meet people nearby.';
  end if;
  return new;
end;
$$;

create trigger on_public_profile_age
  before insert or update on public.public_profiles
  for each row execute function public.enforce_public_age();

-- Do two public people fit each other's preferences?
create or replace function public.public_compatible(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.public_profiles x
    join public.public_profiles y on y.user_id = b
    where x.user_id = a
      and x.enabled and y.enabled
      and x.birthdate is not null and y.birthdate is not null
      -- ages, both ways
      and public.years_old(y.birthdate) between x.pref_age_min and x.pref_age_max
      and public.years_old(x.birthdate) between y.pref_age_min and y.pref_age_max
      -- genders, both ways (empty = open to anyone)
      and (cardinality(x.pref_genders) = 0 or y.gender = any (x.pref_genders))
      and (cardinality(y.pref_genders) = 0 or x.gender = any (y.pref_genders))
      -- looking for something in common (if both said)
      and (cardinality(x.looking_for) = 0 or cardinality(y.looking_for) = 0 or x.looking_for && y.looking_for)
      and not public.is_blocked_between(a, b)
  );
$$;

-- Requests are only allowed between compatible people.
create or replace function public.can_request_slot(sid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.public_slots s
    where s.id = sid
      and s.user_id <> auth.uid()
      and s.ends_at > now()
      and public.public_compatible(auth.uid(), s.user_id)
  );
$$;

-- Browse: nearby, compatible, free — with what you have in common.
drop function if exists public.nearby_public_slots(timestamptz, timestamptz);
create function public.nearby_public_slots(p_from timestamptz, p_to timestamptz)
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
  my_request text,
  age integer,
  gender text,
  sexuality text,
  interests text[],
  looking_for text[],
  shared_interests text[]
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select pp.*
    from public.public_profiles pp
    where pp.user_id = auth.uid() and pp.enabled and pp.lat is not null and pp.lng is not null
  ),
  candidates as (
    select s.id as sid, s.user_id as uid, s.starts_at as s_start, s.ends_at as s_end, s.note as s_note,
      p.username as uname, p.display_name as dname, p.avatar_emoji as emoji,
      o.birthdate as o_birth, o.gender as o_gender, o.sexuality as o_sex, o.show_sexuality as o_show,
      o.interests as o_interests, o.looking_for as o_looking,
      array(select unnest(o.interests) intersect select unnest(me.interests)) as shared,
      (6371 * acos(least(1, greatest(-1,
        cos(radians(me.lat)) * cos(radians(o.lat)) * cos(radians(o.lng) - radians(me.lng))
        + sin(radians(me.lat)) * sin(radians(o.lat))
      )))) as km,
      me.radius_km as radius
    from me
    join public.public_profiles o on o.enabled and o.lat is not null and o.lng is not null and o.user_id <> auth.uid()
    join public.public_slots s on s.user_id = o.user_id
    join public.profiles p on p.id = o.user_id
    where s.ends_at > now()
      and s.starts_at < p_to and s.ends_at > p_from
      and public.public_compatible(auth.uid(), o.user_id)
  )
  select c.sid, c.uid, c.uname, c.dname, c.emoji, c.s_start, c.s_end, c.s_note,
    greatest(1, ceil(c.km))::integer,
    exists (
      select 1 from public.public_slots mine
      where mine.user_id = auth.uid() and mine.starts_at < c.s_end and mine.ends_at > c.s_start
    ) as is_overlap,
    (select r.status from public.hangout_requests r where r.from_user = auth.uid() and r.slot_id = c.sid),
    public.years_old(c.o_birth),
    c.o_gender,
    case when c.o_show then c.o_sex else null end,
    c.o_interests,
    c.o_looking,
    c.shared
  from candidates c
  where c.km <= c.radius
  order by is_overlap desc, cardinality(c.shared) desc, c.s_start
  limit 100;
$$;

-- Status now also says whether the public profile is filled in.
drop function if exists public.my_public_status(timestamptz);
create function public.my_public_status(p_day_of timestamptz default now())
returns table (
  enabled boolean, has_location boolean, radius_km smallint, used_minutes integer, limit_minutes integer, has_profile boolean
)
language sql stable security definer set search_path = public
as $$
  select
    coalesce(pp.enabled, false),
    pp.lat is not null,
    coalesce(pp.radius_km, 10::smallint),
    public.public_minutes_on_day(auth.uid(), p_day_of),
    case when public.has_public_unlimited(auth.uid()) then null else 120 end,
    pp.birthdate is not null
  from (select auth.uid() as uid) u
  left join public.public_profiles pp on pp.user_id = u.uid;
$$;

revoke execute on function public.public_compatible(uuid, uuid), public.nearby_public_slots(timestamptz, timestamptz),
  public.my_public_status(timestamptz), public.enforce_public_age(), public.years_old(date)
from public, anon;
revoke execute on function public.enforce_public_age(), public.public_compatible(uuid, uuid) from authenticated;
grant execute on function public.nearby_public_slots(timestamptz, timestamptz), public.my_public_status(timestamptz),
  public.years_old(date)
to authenticated;
