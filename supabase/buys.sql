-- AGI-1's $AGI buy bot (2026-10-06, the owner: "add a very simple buybot to the tgbot with a minimum buy of $100 just for
-- $AGI with robot emojis and with a gif of her … with mc, price amount of agi, etc."). Our server reads $AGI's newest trades
-- from clank.trade and posts each new buy of $50 or more in her Telegram groups (server/buys.js). This file gives it what
-- it needs from the database, and the clock that makes it look every minute.
--
-- Before running it (once, in the Supabase project that SUPABASE_URL points to; two switches, both free):
--   1. Integrations → Cron → enable it (the pg_cron extension: Supabase's own scheduler)
--   2. Database → Extensions → search "pg_net" → enable it (lets the scheduler call our site)
-- Then: SQL Editor → New query → paste all of this → Run. It ends by showing buys_ready = 1 (the database part) and
-- buys_scheduled = 1 (the clock). buys_scheduled = 0 means step 1 or 2 isn't done yet: do it, then run this file again.
-- It only ADDS two tables, two functions and two cron jobs (all named agi1_buy… / buy_… / agi1-buys…). Nothing the original
-- site uses changes. Running it again changes nothing that's saved (the key stays the same).
--
-- What's kept, and why:
--   agi1_buys       the clank.trade trade ids of the buys already seen (a trade's chain, block, transaction and log number:
--                   public data from Robinhood Chain, never anything about a visitor), so each buy is posted once, even
--                   when two checks run at once; 7 days kept
--   agi1_buy_state  one row: when the buy bot first looked (its first look only notes the buys already there: nobody
--                   gets old news) and a random key, made here once, that the clock sends with each call (only this
--                   database and our server ever see it: the cron job reads it from this table each time)
-- Only the server (the secret key) can use them.

create table if not exists public.agi1_buys (
  id text        primary key check (char_length(id) between 8 and 200),
  at timestamptz not null default now()
);
create index if not exists agi1_buys_at on public.agi1_buys (at);

create table if not exists public.agi1_buy_state (
  id      smallint    primary key default 1 check (id = 1),
  started timestamptz,                                    -- the buy bot's first look (null: it hasn't looked yet)
  key     text        not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into public.agi1_buy_state (id) values (1) on conflict (id) do nothing;

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_buys enable row level security;
alter table public.agi1_buy_state enable row level security;
revoke all on table public.agi1_buys from anon, authenticated;
revoke all on table public.agi1_buy_state from anon, authenticated;

-- The key the clock sends (our server reads it once per server copy, to check each call really comes from here)
create or replace function public.buy_key()
returns text
language sql
stable
set search_path = public
as $$
  select key from agi1_buy_state where id = 1;
$$;

-- The buys our server just read (clank.trade's trade ids, at most 200; none is fine): which of them are new, claimed for
-- this call only (two calls at once never get the same one). The very first call (the bot's first look) notes them all
-- and returns none: they're old news. → the new ids (an empty array when none)
create or replace function public.buy_take(p_ids text[])
returns text[]
language plpgsql
set search_path = public
as $$
declare
  v_first boolean;
  v_new   text[];
begin
  if p_ids is null or cardinality(p_ids) > 200 then
    return '{}';
  end if;
  update agi1_buy_state set started = now() where id = 1 and started is null;
  v_first := found;
  if cardinality(p_ids) = 0 then
    return '{}';
  end if;
  with fresh as (
    insert into agi1_buys (id)
    select distinct x from unnest(p_ids) as x
    where x ~ '^[0-9]{1,10}:0x[0-9a-f]{64}:0x[0-9a-f]{64}:[0-9]{1,6}$'
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(id order by id), '{}') into v_new from fresh;
  delete from agi1_buys where at < now() - interval '7 days';
  if v_first then
    return '{}';
  end if;
  return v_new;
end;
$$;

-- Only the server's secret key may call them.
revoke all on function public.buy_key() from public, anon, authenticated;
revoke all on function public.buy_take(text[]) from public, anon, authenticated;
grant execute on function public.buy_key() to service_role;
grant execute on function public.buy_take(text[]) to service_role;

-- The clock: every minute, Supabase Cron calls our site's buy check with the key (pg_net, an HTTPS request; nothing else
-- is sent). Its run history is tidied once a day (Supabase keeps a row per run otherwise). Only when both switches above
-- are on; otherwise a note says what to switch on.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('agi1-buys', '* * * * *', $cmd$
      select net.http_get(
        url := 'https://www.agi1.app/api/feed?buys',
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select key from public.agi1_buy_state where id = 1)),
        timeout_milliseconds := 25000
      );
    $cmd$);
    perform cron.schedule('agi1-buys-tidy', '17 3 * * *', $cmd$
      delete from cron.job_run_details where end_time < now() - interval '3 days';
    $cmd$);
  else
    raise notice 'The buy bot''s clock is not set yet: switch on Integrations → Cron (pg_cron) and Database → Extensions → pg_net, then run this file again';
  end if;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: buys_ready = 1 (the database part), buys_scheduled = 1 (the clock, every minute).
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('buy_key', 'buy_take')) / 2 as buys_ready,
  (select count(*) from pg_extension where extname = 'pg_cron') * (select count(*) from pg_extension where extname = 'pg_net') as buys_scheduled;
