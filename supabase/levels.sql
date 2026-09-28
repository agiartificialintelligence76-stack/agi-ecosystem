-- $AGI relationship levels (Phase 3): what AGI-1 remembers about Crush and Soulmate wallets.
-- Run this once in the Supabase project that SUPABASE_URL points to: SQL Editor → New query → paste → Run.
-- Stored per wallet: the name you gave AGI-1, and (Soulmate) up to 8 short notes she wrote from your chats.
-- The wallet address itself is never stored: the server uses a scrambled code made from it with PASS_SECRET.
-- "Forget me" on the website deletes the row. Only the server (secret key) can use any of this.

create table if not exists public.agi_friends (
  who        text        primary key,                          -- the wallet's scrambled code
  name       text        check (name is null or char_length(name) between 1 and 24),
  notes      text[]      not null default '{}',                -- newest last, at most 8
  updated_at timestamptz not null default now()
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change this table.
alter table public.agi_friends enable row level security;
revoke all on table public.agi_friends from anon, authenticated;

-- What AGI-1 remembers about one wallet: {"name": ..., "notes": [...]}, or null if nothing.
create or replace function public.friend_get(p_who text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('name', name, 'notes', notes) from agi_friends where who = p_who;
$$;

-- Save the name you want AGI-1 to use (null clears it).
create or replace function public.friend_set_name(p_who text, p_name text)
returns json
language plpgsql
set search_path = public
as $$
begin
  insert into agi_friends (who, name) values (p_who, p_name)
  on conflict (who) do update set name = excluded.name, updated_at = now();
  return friend_get(p_who);
end;
$$;

-- Add one short note (skipped if she already has it). Keeps only the newest p_max notes.
create or replace function public.friend_add_note(p_who text, p_note text, p_max integer default 8)
returns json
language plpgsql
set search_path = public
as $$
declare
  current_notes text[];
begin
  if p_note is null or char_length(p_note) not between 1 and 80 then return friend_get(p_who); end if;
  select notes into current_notes from agi_friends where who = p_who for update;
  if current_notes is null then
    insert into agi_friends (who, notes) values (p_who, array[p_note]) on conflict (who) do nothing;
  elsif not (lower(p_note) = any (select lower(n) from unnest(current_notes) n)) then
    current_notes := array_append(current_notes, p_note);
    if cardinality(current_notes) > p_max then
      current_notes := current_notes[cardinality(current_notes) - p_max + 1 : cardinality(current_notes)];
    end if;
    update agi_friends set notes = current_notes, updated_at = now() where who = p_who;
  end if;
  return friend_get(p_who);
end;
$$;

-- "Forget me": delete everything stored for this wallet. Answers true if there was something to delete.
create or replace function public.friend_forget(p_who text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  delete from agi_friends where who = p_who;
  return found;
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.friend_get(text) from public, anon, authenticated;
revoke all on function public.friend_set_name(text, text) from public, anon, authenticated;
revoke all on function public.friend_add_note(text, text, integer) from public, anon, authenticated;
revoke all on function public.friend_forget(text) from public, anon, authenticated;
grant execute on function public.friend_get(text) to service_role;
grant execute on function public.friend_set_name(text, text) to service_role;
grant execute on function public.friend_add_note(text, text, integer) to service_role;
grant execute on function public.friend_forget(text) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show friend_functions_found = 4.
select count(*) as friend_functions_found from pg_proc
where proname in ('friend_get', 'friend_set_name', 'friend_add_note', 'friend_forget');
