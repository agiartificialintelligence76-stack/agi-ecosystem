-- $AGI "The Arena": which coins are in it (Phase 6).
-- Note (2026-09-28, this folder): the database is shared with the original site, where $CABO is a core coin, so it stays
-- here as it is. This site never shows it or takes votes for it: server/arena.js → HIDDEN_COINS.
-- Visitors nominate clank.trade coins. A coin joins the Arena when 20 different humans vote for it within 7 days.
-- The Arena holds 8 coins: $AGI and $CABO always stay, plus up to 6 others. When it's full, the coin with the fewest
-- Arena votes in the last 7 days makes room (a coin that joined less than a day ago is safe).
-- The server checks every nomination with clank.trade and DexScreener before it gets here (server/coins.js).
--
-- Run this AFTER supabase/arena.sql, in the same Supabase project: SQL Editor → New query → paste → Run.
-- Running it again is safe (nothing is deleted). Visitors are stored only as scrambled codes (one per coin, or one per
-- day), never as IP addresses. Only the server (secret key) can use any of this.
--
-- Owner tools (SQL Editor → New query → type one line → Run):
--   select coin_remove('PEPE');     takes a coin out of the Arena for good (ticker or address; AGI and CABO always stay)
--   select coin_restore('PEPE');    undoes that (the coin can then be nominated again)
--   select symbol, status, name, note from arena_coins order by status, symbol;    every coin and its status

do $$
begin
  if to_regclass('public.arena_tally') is null then
    raise exception 'Run supabase/arena.sql first, then this file.';
  end if;
end;
$$;

-- Every coin the Arena knows: its own coins, the ones voters added, nominations, and coins that left.
create table if not exists public.arena_coins (
  address    text        primary key check (address ~ '^0x[0-9a-f]{40}$'),   -- contract on Robinhood Chain, lowercase
  symbol     text        not null check (symbol ~ '^[A-Z0-9]{1,12}$'),       -- ticker without the $
  name       text        not null check (char_length(name) between 1 and 40),
  logo       text        not null default '' check (char_length(logo) <= 300),  -- where clank.trade keeps its picture
  status     text        not null default 'candidate'
             check (status in ('core', 'listed', 'candidate', 'retired', 'hidden')),
  created_at timestamptz not null default now(),       -- nominated
  listed_at  timestamptz,                              -- joined the Arena
  retired_at timestamptz,                              -- left the Arena
  note       text        not null default ''           -- why it left: 'made room', 'low liquidity', 'removed by the owner'
);
-- One coin per ticker, so crowns and votes (kept by ticker in arena.sql) never mix two coins.
create unique index if not exists arena_coins_symbol on public.arena_coins (symbol);

-- Votes to add a nominated coin. `who` is a scrambled code for "this visitor, this coin": it can't be linked to other
-- coins or to Arena votes. One vote per visitor per coin per 7 days; old rows are deleted.
create table if not exists public.arena_coin_votes (
  address text        not null references public.arena_coins (address) on delete cascade,
  who     text        not null,
  at      timestamptz not null default now(),
  primary key (address, who)
);

-- Nominations per visitor per day (the daily visitor code, like the chat's): at most 2 each, 50 for the whole site.
create table if not exists public.arena_coin_nominations (
  day date    not null,
  who text    not null,
  n   integer not null default 0,
  primary key (day, who)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.arena_coins enable row level security;
alter table public.arena_coin_votes enable row level security;
alter table public.arena_coin_nominations enable row level security;
revoke all on table public.arena_coins, public.arena_coin_votes, public.arena_coin_nominations from anon, authenticated;

-- The coins the Arena started with. $AGI and $CABO are "core": they always stay.
insert into public.arena_coins (address, symbol, name, logo, status, listed_at) values
  ('0xfa31d04462746aaa24bc7e5626403e09e4b106ec', 'AGI', 'Artificial Girlfriend Intelligence', '/images/coins/agi.webp', 'core', now()),
  ('0xcf5b720f33febdc1c9d4880b8317203b63fdf368', 'CABO', 'CABO the cat', '/images/coins/cabo.webp', 'core', now()),
  ('0x03e6a6881d0813bf6157ac4ee44d3cc73d5465a3', 'CLANKCAT', 'Clank Cat', '/images/coins/clankcat.webp', 'listed', now() - interval '2 days')
on conflict (address) do nothing;

-- Votes a nominated coin got in the last 7 days.
create or replace function public.coin_votes_week(p_address text)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int from arena_coin_votes where address = p_address and at > now() - interval '7 days';
$$;

-- Adds every nominated coin that reached p_need votes, while there's room: at most p_max coins besides AGI and CABO.
-- When the Arena is full, the coin with the fewest Arena votes in the last 7 days leaves (if it has been in for a day);
-- if every coin is brand new, the nominee waits and gets in at the next check. Answers how many coins were added.
create or replace function public.coin_promote(p_need integer, p_max integer)
returns integer
language plpgsql
set search_path = public
as $$
declare
  c record;
  added integer := 0;
  loser text;
  week_start bigint := floor(extract(epoch from now()) / 300)::bigint - 2016;   -- the Arena round 7 days ago
begin
  if not exists (select 1 from arena_coins a where a.status = 'candidate' and coin_votes_week(a.address) >= p_need) then
    return 0;
  end if;
  perform pg_advisory_xact_lock(4663001);          -- one at a time, so the Arena never ends up with too many coins
  for c in
    select a.address, coin_votes_week(a.address) as votes, a.created_at from arena_coins a
    where a.status = 'candidate' and coin_votes_week(a.address) >= p_need
    order by 2 desc, a.created_at
  loop
    if (select count(*) from arena_coins where status = 'listed') >= p_max then
      select a.address into loser from arena_coins a
      where a.status = 'listed' and a.listed_at < now() - interval '1 day'
      order by (select coalesce(sum(t.votes), 0) from arena_tally t where t.coin = a.symbol and t.round >= week_start), a.listed_at
      limit 1;
      exit when loser is null;
      update arena_coins set status = 'retired', retired_at = now(), note = 'made room' where address = loser;
    end if;
    update arena_coins set status = 'listed', listed_at = now(), retired_at = null, note = '' where address = c.address;
    delete from arena_coin_votes where address = c.address;   -- used up: if it ever leaves, it starts again from zero
    added := added + 1;
  end loop;
  return added;
end;
$$;

-- One visitor's vote to add a coin. Answers { result, symbol, votes }:
--   ok / already (voted in the last 7 days) / added (this vote got it in) / waiting (enough votes, but the Arena is full
--   of brand-new coins) / listed (already in the Arena) / retired (left the Arena: nominate it again) / hidden / unknown.
create or replace function public.coin_vote(p_address text, p_who text, p_need integer default 20, p_max integer default 6)
returns json
language plpgsql
set search_path = public
as $$
declare
  coin arena_coins;
  added integer;
  n integer;
begin
  select * into coin from arena_coins where address = p_address;
  if not found then return json_build_object('result', 'unknown'); end if;
  if coin.status in ('hidden', 'retired') then return json_build_object('result', coin.status, 'symbol', coin.symbol); end if;
  if coin.status in ('core', 'listed') then return json_build_object('result', 'listed', 'symbol', coin.symbol); end if;

  insert into arena_coin_votes (address, who) values (p_address, p_who)
  on conflict (address, who) do update set at = now() where arena_coin_votes.at <= now() - interval '7 days';
  get diagnostics added = row_count;
  n := coin_votes_week(p_address);
  if added = 0 then return json_build_object('result', 'already', 'symbol', coin.symbol, 'votes', n); end if;
  if n >= p_need then
    perform coin_promote(p_need, p_max);
    if (select status from arena_coins where address = p_address) = 'listed' then
      return json_build_object('result', 'added', 'symbol', coin.symbol, 'votes', n);
    end if;
    return json_build_object('result', 'waiting', 'symbol', coin.symbol, 'votes', n);
  end if;
  return json_build_object('result', 'ok', 'symbol', coin.symbol, 'votes', n);
end;
$$;

-- A new nomination (the server already checked the coin with clank.trade and DexScreener). The nominator's vote is the
-- first one. Answers like coin_vote plus "nominated": true, or { result: too_many | busy | symbol_taken }.
create or replace function public.coin_nominate(p_address text, p_symbol text, p_name text, p_logo text,
  p_day date, p_day_who text, p_who text,
  p_need integer default 20, p_max integer default 6, p_daily integer default 2, p_site integer default 50)
returns json
language plpgsql
set search_path = public
as $$
declare
  coin arena_coins;
  other arena_coins;
  used integer;
begin
  perform pg_advisory_xact_lock(4663002);          -- one nomination at a time (the ticker check below)
  select * into coin from arena_coins where address = p_address;
  if found and coin.status <> 'retired' then
    return coin_vote(p_address, p_who, p_need, p_max);   -- nominated a moment ago by someone else, or already in
  end if;
  select coalesce(sum(n), 0) into used from arena_coin_nominations where day = p_day and who = p_day_who;
  if used >= p_daily then return json_build_object('result', 'too_many'); end if;
  select coalesce(sum(n), 0) into used from arena_coin_nominations where day = p_day;
  if used >= p_site then return json_build_object('result', 'busy'); end if;

  select * into other from arena_coins where symbol = p_symbol and address <> p_address;
  if found then
    if other.status = 'candidate' and coin_votes_week(other.address) = 0 then
      delete from arena_coins where address = other.address;       -- a forgotten nomination frees its ticker
    else
      return json_build_object('result', 'symbol_taken', 'symbol', p_symbol);
    end if;
  end if;

  insert into arena_coins (address, symbol, name, logo, status) values (p_address, p_symbol, p_name, p_logo, 'candidate')
  on conflict (address) do update set symbol = excluded.symbol, name = excluded.name, logo = excluded.logo,
    status = 'candidate', created_at = now(), note = '';
  delete from arena_coin_votes where address = p_address;
  insert into arena_coin_nominations (day, who, n) values (p_day, p_day_who, 1)
  on conflict (day, who) do update set n = arena_coin_nominations.n + 1;

  if random() < 0.05 then                          -- tidy up now and then
    delete from arena_coin_nominations where day < p_day - 3;
    delete from arena_coin_votes where at < now() - interval '8 days';
    delete from arena_coins a where a.status = 'candidate' and a.created_at < now() - interval '30 days'
      and not exists (select 1 from arena_coin_votes v where v.address = a.address);
  end if;
  return (coin_vote(p_address, p_who, p_need, p_max)::jsonb || '{"nominated": true}'::jsonb)::json;
end;
$$;

-- What the page shows: the coins in the Arena (AGI and CABO first), coins that left in the last 30 days (so a recent
-- champion still has its name and logo), and the top 12 nominations with their votes this week.
-- It first adds any nominee that reached the goal while the Arena was full.
create or replace function public.coin_board(p_need integer default 20, p_max integer default 6)
returns json
language plpgsql
set search_path = public
as $$
begin
  perform coin_promote(p_need, p_max);
  return json_build_object(
    'coins', coalesce((select json_agg(json_build_object('address', a.address, 'symbol', a.symbol, 'name', a.name,
        'logo', a.logo, 'status', a.status, 'listed_at', a.listed_at) order by a.status <> 'core', a.listed_at, a.symbol)
      from arena_coins a where a.status in ('core', 'listed')), '[]'::json),
    'retired', coalesce((select json_agg(r order by r.retired_at desc) from (
        select a.address, a.symbol, a.name, a.logo, a.retired_at from arena_coins a
        where a.status = 'retired' and a.retired_at > now() - interval '30 days'
        order by a.retired_at desc limit 20) r), '[]'::json),
    'candidates', coalesce((select json_agg(x order by x.votes desc, x.created_at) from (
        select a.address, a.symbol, a.name, a.created_at, count(*)::int as votes
        from arena_coins a join arena_coin_votes v on v.address = a.address and v.at > now() - interval '7 days'
        where a.status = 'candidate'
        group by a.address, a.symbol, a.name, a.created_at
        order by votes desc, a.created_at
        limit 12) x), '[]'::json)
  );
end;
$$;

-- The tickers that can get Arena votes right now (the vote endpoint checks against this).
create or replace function public.coin_active()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(symbol order by symbol), '[]'::json) from arena_coins where status in ('core', 'listed');
$$;

-- Where a coin's logo is kept, for the logo endpoint. Only coins that are (or were) in the Arena: never nominations,
-- never removed coins.
create or replace function public.coin_logo(p_address text)
returns text
language sql
stable
set search_path = public
as $$
  select logo from arena_coins where address = p_address and status in ('core', 'listed', 'retired');
$$;

-- Takes coins out of the Arena (the keep-alive job does this when a coin's liquidity is almost gone). Never AGI or CABO.
create or replace function public.coin_retire(p_addresses text[], p_note text default 'low liquidity')
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update arena_coins set status = 'retired', retired_at = now(), note = left(coalesce(p_note, ''), 60)
  where address = any(p_addresses) and status = 'listed';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Owner tool: take a coin out for good. select coin_remove('PEPE');
create or replace function public.coin_remove(p_coin text)
returns text
language plpgsql
set search_path = public
as $$
declare
  coin arena_coins;
begin
  select * into coin from arena_coins
  where address = lower(trim(p_coin)) or symbol = upper(trim(both ' $' from p_coin));
  if not found then return 'No coin called ' || p_coin || ' in the Arena list.'; end if;
  if coin.status = 'core' then return '$' || coin.symbol || ' always stays in the Arena.'; end if;
  update arena_coins set status = 'hidden', retired_at = coalesce(retired_at, now()), note = 'removed by the owner'
  where address = coin.address;
  delete from arena_coin_votes where address = coin.address;
  return '$' || coin.symbol || ' was removed from the Arena and can''t be nominated again. To undo: select coin_restore('''
    || coin.symbol || ''');';
end;
$$;

-- Owner tool: undo coin_remove. select coin_restore('PEPE');
create or replace function public.coin_restore(p_coin text)
returns text
language plpgsql
set search_path = public
as $$
declare
  coin arena_coins;
begin
  select * into coin from arena_coins
  where address = lower(trim(p_coin)) or symbol = upper(trim(both ' $' from p_coin));
  if not found then return 'No coin called ' || p_coin || ' in the Arena list.'; end if;
  if coin.status <> 'hidden' then return '$' || coin.symbol || ' was not removed.'; end if;
  update arena_coins set status = 'retired', note = 'restored by the owner' where address = coin.address;
  return '$' || coin.symbol || ' is back: it can be nominated again.';
end;
$$;

-- Only the server (the secret key = service_role) may call these. The owner tools only work in the SQL editor.
revoke all on function public.coin_votes_week(text) from public, anon, authenticated;
revoke all on function public.coin_promote(integer, integer) from public, anon, authenticated;
revoke all on function public.coin_vote(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.coin_nominate(text, text, text, text, date, text, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.coin_board(integer, integer) from public, anon, authenticated;
revoke all on function public.coin_active() from public, anon, authenticated;
revoke all on function public.coin_logo(text) from public, anon, authenticated;
revoke all on function public.coin_retire(text[], text) from public, anon, authenticated;
revoke all on function public.coin_remove(text) from public, anon, authenticated, service_role;
revoke all on function public.coin_restore(text) from public, anon, authenticated, service_role;
grant execute on function public.coin_votes_week(text) to service_role;
grant execute on function public.coin_promote(integer, integer) to service_role;
grant execute on function public.coin_vote(text, text, integer, integer) to service_role;
grant execute on function public.coin_nominate(text, text, text, text, date, text, text, integer, integer, integer, integer) to service_role;
grant execute on function public.coin_board(integer, integer) to service_role;
grant execute on function public.coin_active() to service_role;
grant execute on function public.coin_logo(text) to service_role;
grant execute on function public.coin_retire(text[], text) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show coin_functions_found = 10.
select count(*) as coin_functions_found from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('coin_votes_week', 'coin_promote', 'coin_vote', 'coin_nominate',
  'coin_board', 'coin_active', 'coin_logo', 'coin_retire', 'coin_remove', 'coin_restore');
