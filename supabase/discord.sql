-- AGI-1's holder roles in her Discord server (2026-10-29, server/dc-holders.js): who verified which wallet, so her bot can
-- give the 💘 Crush or 💞 Soulmate role, re-check it a few times a day, and take it back.
-- Run this once in the Supabase project that SUPABASE_URL points to: SQL Editor -> New query -> paste -> Run.
-- Safe to run again (it changes nothing that's there).
--
-- One row per Discord account and server that verified a wallet with 10,000+ $AGI (held, or burned for messages):
--   who        a scrambled code of the Discord account in that server (HMAC with PASS_SECRET), never its id
--   wallet     a scrambled code of the wallet in that server (another HMAC): one wallet gives a role to one account
--   sealed     the server's id, the account's id and the wallet's address, encrypted with PASS_SECRET (AES-256-GCM), ONLY
--              so our server can read the wallet's $AGI again and give or take back the role
--   level      the role she gave: 2 = 💘 Crush, 3 = 💞 Soulmate
--   checked_at when its $AGI was last read (the cron re-checks the oldest first)
-- "Remove my role" in the server deletes the row, and so does leaving the server or dropping under 10,000 $AGI.

create table if not exists public.agi_dc_holders (
  who        text        primary key check (char_length(who) between 16 and 64),
  wallet     text        not null unique check (char_length(wallet) between 16 and 64),
  sealed     text        not null check (char_length(sealed) between 40 and 400),
  level      smallint    not null check (level between 2 and 3),
  checked_at timestamptz not null default now(),
  linked_at  timestamptz not null default now()
);
create index if not exists agi_dc_holders_due on public.agi_dc_holders (checked_at);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change this table.
alter table public.agi_dc_holders enable row level security;
revoke all on table public.agi_dc_holders from anon, authenticated;

-- A verified wallet (or a re-verified one): this account's row, made or changed. Another account that had this wallet
-- loses it here (its sealed ids come back, so our server takes its role back).
-- -> {"ok": true, "before": its level before (null: new), "moved": the other account's sealed ids or null, "moved_level"}
--    · {"ok": false, "why": "bad" | "busy"}
create or replace function public.dc_holder_link(p_who text, p_wallet text, p_sealed text, p_level integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_before smallint;
  v_moved text;
  v_moved_level smallint;
begin
  if p_who is null or char_length(p_who) not between 16 and 64
     or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_sealed is null or char_length(p_sealed) not between 40 and 400
     or p_level is null or p_level not between 2 and 3 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  delete from agi_dc_holders where wallet = p_wallet and who <> p_who returning sealed, level into v_moved, v_moved_level;
  select level into v_before from agi_dc_holders where who = p_who;
  insert into agi_dc_holders (who, wallet, sealed, level) values (p_who, p_wallet, p_sealed, p_level)
  on conflict (who) do update
    set wallet = excluded.wallet, sealed = excluded.sealed, level = excluded.level, checked_at = now(), linked_at = now();
  return json_build_object('ok', true, 'before', v_before, 'moved', v_moved, 'moved_level', v_moved_level);
exception when unique_violation then
  return json_build_object('ok', false, 'why', 'busy');
end;
$$;

-- One account's row: {"level", "sealed", "wallet"} or null
create or replace function public.dc_holder_get(p_who text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('level', level, 'sealed', sealed, 'wallet', wallet) from agi_dc_holders where who = p_who;
$$;

-- The re-check's next few: the rows read longest ago (and not in the last p_minutes), marked as read now so two runs at
-- once never take the same ones -> [{"who", "sealed", "level"}]
create or replace function public.dc_holder_due(p_limit integer default 25, p_minutes integer default 150)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_rows json;
begin
  with due as (
    select who from agi_dc_holders
    where checked_at < now() - make_interval(mins => greatest(coalesce(p_minutes, 150), 1))
    order by checked_at
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    for update skip locked
  ), marked as (
    update agi_dc_holders h set checked_at = now() from due where h.who = due.who
    returning h.who, h.sealed, h.level
  )
  select coalesce(json_agg(json_build_object('who', who, 'sealed', sealed, 'level', level)), '[]'::json) into v_rows from marked;
  return v_rows;
end;
$$;

-- A re-checked row's level -> true, or false if it's gone
create or replace function public.dc_holder_set(p_who text, p_level integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_level is null or p_level not between 2 and 3 then return false; end if;
  update agi_dc_holders set level = p_level, checked_at = now() where who = p_who;
  return found;
end;
$$;

-- A row deleted ("Remove my role", left the server, under 10,000 $AGI) -> {"sealed", "level"} it had, or null
-- (p_wallet: only if it's still that wallet's; null: whichever)
create or replace function public.dc_holder_drop(p_who text, p_wallet text default null)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_sealed text;
  v_level smallint;
begin
  delete from agi_dc_holders where who = p_who and (p_wallet is null or wallet = p_wallet) returning sealed, level into v_sealed, v_level;
  if v_sealed is null then return null; end if;
  return json_build_object('sealed', v_sealed, 'level', v_level);
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.dc_holder_link(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.dc_holder_get(text) from public, anon, authenticated;
revoke all on function public.dc_holder_due(integer, integer) from public, anon, authenticated;
revoke all on function public.dc_holder_set(text, integer) from public, anon, authenticated;
revoke all on function public.dc_holder_drop(text, text) from public, anon, authenticated;
grant execute on function public.dc_holder_link(text, text, text, integer) to service_role;
grant execute on function public.dc_holder_get(text) to service_role;
grant execute on function public.dc_holder_due(integer, integer) to service_role;
grant execute on function public.dc_holder_set(text, integer) to service_role;
grant execute on function public.dc_holder_drop(text, text) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show discord_functions_found = 5.
select count(*) as discord_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('dc_holder_link', 'dc_holder_get', 'dc_holder_due', 'dc_holder_set', 'dc_holder_drop');
