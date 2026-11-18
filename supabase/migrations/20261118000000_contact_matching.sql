-- Find friends from your contacts, without uploading your address book.
--
-- Each user's email (verified at signup) and, optionally, their phone number are stored
-- only as SHA-256 hashes. The app hashes your contacts on your phone and asks
-- "which of these hashes belong to Pingle users?" — the server never sees the contacts.
--
-- Hash format (must match src/lib/contacts.ts):
--   email: sha256('email:' || lower(trim(email)))
--   phone: sha256('phone:' || digits-only number, with a leading country code)

create table public.contact_hashes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (kind, hash, user_id)
);
create index contact_hashes_hash_idx on public.contact_hashes (hash);

alter table public.contact_hashes enable row level security;

-- You can see and manage only your own rows. Nobody can list anyone else's.
create policy "contact hashes own read" on public.contact_hashes for select to authenticated
  using (user_id = auth.uid());
-- Users may only add/remove their own *phone* hash; email hashes come from signup.
create policy "contact hashes own phone insert" on public.contact_hashes for insert to authenticated
  with check (user_id = auth.uid() and kind = 'phone' and verified = false);
create policy "contact hashes own phone delete" on public.contact_hashes for delete to authenticated
  using (user_id = auth.uid() and kind = 'phone');

-- Email hashes are written by the server from the confirmed signup email.
create or replace function public.sync_email_hash()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;
  delete from public.contact_hashes where user_id = new.id and kind = 'email';
  insert into public.contact_hashes (user_id, kind, hash, verified)
  values (
    new.id,
    'email',
    encode(sha256(convert_to('email:' || lower(trim(new.email)), 'UTF8')), 'hex'),
    true
  )
  on conflict do nothing;
  return new;
end;
$$;

-- Runs after the profile is created (on_auth_user_created), and whenever the email changes.
create trigger on_auth_user_email_hash
  after insert or update of email on auth.users
  for each row execute function public.sync_email_hash();

-- Backfill existing users.
insert into public.contact_hashes (user_id, kind, hash, verified)
select u.id, 'email', encode(sha256(convert_to('email:' || lower(trim(u.email)), 'UTF8')), 'hex'), true
from auth.users u
join public.profiles p on p.id = u.id
where u.email is not null
on conflict do nothing;

-- Given hashes from your contacts, return the matching Pingle users (never yourself).
-- Capped so it can't be used to sweep the whole user base.
create or replace function public.match_contacts(hashes text[])
returns table (hash text, kind text, verified boolean, id uuid, username text, display_name text, avatar_emoji text)
language sql stable security definer set search_path = public
as $$
  select c.hash, c.kind, c.verified, p.id, p.username, p.display_name, p.avatar_emoji
  from public.contact_hashes c
  join public.profiles p on p.id = c.user_id
  where auth.uid() is not null
    and c.user_id <> auth.uid()
    and c.hash = any (hashes[1:2000]);
$$;

revoke execute on function public.match_contacts(text[]) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;
revoke execute on function public.sync_email_hash() from public, anon, authenticated;
