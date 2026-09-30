-- AGI-1: messages paid for by burning $AGI (2026-09-30, the owner's idea: "every chat $AGI is burned").
-- Run this once in the Supabase project that SUPABASE_URL points to, any time: SQL Editor → New query → paste all of it →
-- Run. It ends by showing burn_functions_found = 7. **Until it's run, nobody sees a burn button or the burn monitor**: the
-- site asks for these functions first, so nobody can burn $AGI before our server can count it.
-- It only ADDS five new tables and seven functions (all named agi1_burn… / burn_…). It doesn't touch any table the
-- original site uses, so it's safe in the database both sites share. Running it again changes nothing that's saved.
--
-- How it works: after their free messages, a visitor with a connected wallet can burn $AGI (send it from their own wallet
-- app to the burn address 0x…dEaD); our server reads that burn on Robinhood Chain and adds messages here (price: the
-- BURN_PER_MESSAGE setting, 10 $AGI a message by default). Each burned message is taken one at a time, after the free
-- ones, and given back if her reply fails (the attempt still counts toward the daily caps, so failures can't run up the AI
-- bill).
--
-- What's kept (never a wallet address or a transaction hash): our server scrambles both first, with this database's own
-- random key (agi1_burn_key, made once here and never changed: so the codes stay the same even if PASS_SECRET is ever
-- changed, and they're different from the wallet codes of levels.sql, so burns can't be matched to a name or notes).
--   agi1_burn_key      one row: that key (only the server reads it)
--   agi1_burn_txs      each burn counted once: the code of (its transaction, the wallet), and the day it was counted
--   agi1_burn_wallets  per wallet: messages left, messages bought in all, the $AGI that bought them (in steps of the price:
--                      it counts toward the level), today's burned messages, when the last one was sent, and that last one's
--                      id (so a failed reply gives back exactly that one, once)
--   agi1_burn_days     per day: burned messages the whole site used (its daily cap) and the $AGI burned (the burn
--                      monitor's "today"), 30 days kept
--   agi1_burn_total    one row: $AGI burned for messages, messages bought, burns counted and when the latest was counted
--                      (the burn monitor above the chat)
-- Only the server (the secret key) can use them.

create table if not exists public.agi1_burn_key (
  id  smallint primary key default 1 check (id = 1),
  key text     not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into public.agi1_burn_key (id) values (1) on conflict (id) do nothing;

create table if not exists public.agi1_burn_txs (
  tx_code text primary key check (char_length(tx_code) between 16 and 64),
  day     date not null default ((now() at time zone 'utc')::date)
);

create table if not exists public.agi1_burn_wallets (
  wallet_code  text        primary key check (char_length(wallet_code) between 16 and 64),
  left_count   bigint      not null default 0 check (left_count >= 0),         -- burned messages not used yet
  bought       bigint      not null default 0 check (bought >= 0),             -- burned messages bought in all
  agi          numeric     not null default 0 check (agi >= 0),                -- whole $AGI burned for them
  day          date,                                                           -- the UTC day `used` counts
  used         integer     not null default 0 check (used >= 0),               -- burned messages taken that day
  last_at      timestamptz not null default 'epoch',                           -- the last one taken
  last_take    text,                                                           -- its id, until given back
  last_take_at timestamptz
);

create table if not exists public.agi1_burn_days (
  day    date    primary key,
  used   integer not null default 0 check (used >= 0),     -- burned messages taken that day, by the whole site
  burned numeric not null default 0                        -- whole $AGI burned (counted) that day
);

create table if not exists public.agi1_burn_total (
  id       smallint    primary key default 1 check (id = 1),
  agi      numeric     not null default 0,
  messages bigint      not null default 0,
  burns    bigint      not null default 0,
  last_at  timestamptz                                     -- when the latest burn was counted
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_burn_key enable row level security;
alter table public.agi1_burn_txs enable row level security;
alter table public.agi1_burn_wallets enable row level security;
alter table public.agi1_burn_days enable row level security;
alter table public.agi1_burn_total enable row level security;
revoke all on table public.agi1_burn_key from anon, authenticated;
revoke all on table public.agi1_burn_txs from anon, authenticated;
revoke all on table public.agi1_burn_wallets from anon, authenticated;
revoke all on table public.agi1_burn_days from anon, authenticated;
revoke all on table public.agi1_burn_total from anon, authenticated;

-- The key our server scrambles addresses and transactions with (read once per server copy)
create or replace function public.burn_key()
returns text
language sql
stable
set search_path = public
as $$
  select key from agi1_burn_key where id = 1;
$$;

-- A burn our server has checked on Robinhood Chain: counted once, its messages added to the wallet's.
-- p_tx: the code of (the transaction, the wallet) · p_wallet: the wallet's code · p_messages: messages it bought ·
-- p_agi: the whole $AGI that bought them. → {"ok": true, "left", "bought", "agi"} or {"ok": false, "why": "used" | "bad"}
create or replace function public.burn_claim(p_tx text, p_wallet text, p_messages bigint, p_agi numeric)
returns json
language plpgsql
set search_path = public
as $$
declare
  w agi1_burn_wallets%rowtype;
begin
  if p_tx is null or char_length(p_tx) not between 16 and 64 or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_messages is null or p_messages < 1 or p_messages > 1000000000
     or p_agi is null or p_agi <= 0 or p_agi > 1000000000 or p_agi <> trunc(p_agi) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- each burn once: two claims of the same burn at the same moment wait for each other here, and the second finds it taken
  insert into agi1_burn_txs (tx_code) values (p_tx) on conflict (tx_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'used'); end if;
  -- today's row before the wallet's (the same order as burn_take and burn_refund, so they never wait for each other in a circle)
  insert into agi1_burn_days as d (day, burned) values ((now() at time zone 'utc')::date, p_agi)
  on conflict (day) do update set burned = d.burned + excluded.burned;
  insert into agi1_burn_wallets as b (wallet_code, left_count, bought, agi) values (p_wallet, p_messages, p_messages, p_agi)
  on conflict (wallet_code) do update
    set left_count = b.left_count + excluded.left_count, bought = b.bought + excluded.bought, agi = b.agi + excluded.agi
  returning * into w;
  insert into agi1_burn_total as t (id, agi, messages, burns, last_at) values (1, p_agi, p_messages, 1, now())
  on conflict (id) do update
    set agi = t.agi + excluded.agi, messages = t.messages + excluded.messages, burns = t.burns + 1, last_at = now();
  return json_build_object('ok', true, 'left', w.left_count, 'bought', w.bought, 'agi', w.agi);
end;
$$;

-- One burned message, after the free ones are used: one atomic step.
-- p_per_day: a wallet's burned messages a day · p_site_daily: the whole site's · p_min_gap_ms: the least time between two ·
-- p_take: this one's id (made by our server), so a failed reply can give back exactly this one.
-- → {"ok": true, "left", "today"} or {"ok": false, "why": "none" | "day_cap" | "site_cap" | "too_fast" | "bad", "left"}
drop function if exists public.burn_take(text, integer, integer, integer);
create or replace function public.burn_take(p_wallet text, p_per_day integer, p_site_daily integer, p_min_gap_ms integer, p_take text)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  s agi1_burn_days%rowtype;
  w agi1_burn_wallets%rowtype;
  used_today integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_per_day is null or p_per_day < 1
     or p_site_daily is null or p_site_daily < 1 or p_min_gap_ms is null or p_min_gap_ms < 0
     or p_take is null or char_length(p_take) not between 16 and 64 then
    return json_build_object('ok', false, 'why', 'bad', 'left', 0);
  end if;
  insert into agi1_burn_days (day) values (today) on conflict (day) do nothing;
  -- Lock the site's row first, then the wallet's (always in this order: burn_claim too), so simultaneous messages
  -- can't sneak past a limit or take the same burned message twice.
  select * into s from agi1_burn_days where day = today for update;
  select * into w from agi1_burn_wallets where wallet_code = p_wallet for update;
  if not found or w.left_count < 1 then return json_build_object('ok', false, 'why', 'none', 'left', 0); end if;
  used_today := case when w.day = today then w.used else 0 end;
  if used_today >= p_per_day then return json_build_object('ok', false, 'why', 'day_cap', 'left', w.left_count); end if;
  if s.used >= p_site_daily then return json_build_object('ok', false, 'why', 'site_cap', 'left', w.left_count); end if;
  if now() - w.last_at < p_min_gap_ms * interval '1 millisecond' then
    return json_build_object('ok', false, 'why', 'too_fast', 'left', w.left_count);
  end if;
  update agi1_burn_wallets
  set left_count = left_count - 1, day = today, used = used_today + 1, last_at = now(), last_take = p_take, last_take_at = now()
  where wallet_code = p_wallet
  returning * into w;
  update agi1_burn_days set used = used + 1 where day = today;
  -- Tidy up: forget the site's daily counts after 30 days (runs on about 2% of calls).
  if random() < 0.02 then
    delete from agi1_burn_days where day < today - 30;
  end if;
  return json_build_object('ok', true, 'left', w.left_count, 'today', w.used);
end;
$$;

-- Her reply failed after a burned message was taken: that one (p_take, taken in the last 5 minutes) is given back, once.
-- The attempt still counts toward today's caps (so failures can't be repeated without end). → {"ok": true, "left"} or {"ok": false}
drop function if exists public.burn_refund(text);
create or replace function public.burn_refund(p_wallet text, p_take text)
returns json
language plpgsql
set search_path = public
as $$
declare
  w agi1_burn_wallets%rowtype;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_take is null then return json_build_object('ok', false); end if;
  perform 1 from agi1_burn_days where day = (now() at time zone 'utc')::date for update;
  select * into w from agi1_burn_wallets where wallet_code = p_wallet for update;
  if not found or w.last_take is distinct from p_take or w.last_take_at < now() - interval '5 minutes' then
    return json_build_object('ok', false);
  end if;
  update agi1_burn_wallets set left_count = left_count + 1, last_take = null
  where wallet_code = p_wallet
  returning * into w;
  return json_build_object('ok', true, 'left', w.left_count);
end;
$$;

-- A wallet's burned messages → {"left", "bought", "agi", "today"} (zeros for a wallet that never burned)
create or replace function public.burn_status(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'left', coalesce(w.left_count, 0),
    'bought', coalesce(w.bought, 0),
    'agi', coalesce(w.agi, 0),
    'today', case when w.day = (now() at time zone 'utc')::date then w.used else 0 end)
  from (select 1) as one
  left join agi1_burn_wallets w on w.wallet_code = p_wallet;
$$;

-- The burn monitor → {"agi", "messages", "burns", "today", "last_at"}: $AGI burned for messages so far by everyone, the
-- messages it bought, how many burns, the $AGI burned today (UTC) and when the latest burn was counted (or null)
create or replace function public.burn_total()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('agi', coalesce(t.agi, 0), 'messages', coalesce(t.messages, 0), 'burns', coalesce(t.burns, 0),
    'today', coalesce((select d.burned from agi1_burn_days d where d.day = (now() at time zone 'utc')::date), 0),
    'last_at', t.last_at)
  from (select 1) as one
  left join agi1_burn_total t on t.id = 1;
$$;

-- Which of these burns were counted already (up to 50 codes; the explorer's list, before our server reads the chain)
create or replace function public.burn_seen(p_txs text[])
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(tx_code order by tx_code), '{}'::text[]) from agi1_burn_txs
  where p_txs is not null and cardinality(p_txs) <= 50 and tx_code = any(p_txs);
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.burn_key() from public, anon, authenticated;
revoke all on function public.burn_claim(text, text, bigint, numeric) from public, anon, authenticated;
revoke all on function public.burn_take(text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.burn_refund(text, text) from public, anon, authenticated;
revoke all on function public.burn_status(text) from public, anon, authenticated;
revoke all on function public.burn_total() from public, anon, authenticated;
revoke all on function public.burn_seen(text[]) from public, anon, authenticated;
grant execute on function public.burn_key() to service_role;
grant execute on function public.burn_claim(text, text, bigint, numeric) to service_role;
grant execute on function public.burn_take(text, integer, integer, integer, text) to service_role;
grant execute on function public.burn_refund(text, text) to service_role;
grant execute on function public.burn_status(text) to service_role;
grant execute on function public.burn_total() to service_role;
grant execute on function public.burn_seen(text[]) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show burn_functions_found = 7.
select count(*) as burn_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('burn_key', 'burn_claim', 'burn_take', 'burn_refund', 'burn_status', 'burn_total', 'burn_seen');
