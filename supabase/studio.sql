-- AGI-1's 3D character studio (2026-10-10, the owner: "what if i launched a where they can create a 3d model with meshy
-- ai api that can move on chat just like vladcat. they can get it by burning $AGI tokens and can launch token with it",
-- then the owner's choices: "Burn $AGI or USDG", holder discounts, a free one a month for Soulmates, Vercel Pro).
-- At agi1.app/studio someone describes a character (checked first: PG-13, never a real person or someone else's character),
-- pays from their OWN wallet app (USDG to the owner's wallet, or $AGI burned to 0x…dEaD: the page never asks a wallet for a
-- transaction), and our server has Meshy make it: a 3D model from the words, painted, given bones, taught its moves; then
-- the file is made small and kept in Supabase Storage (a private bucket, served from our own address). Each character has
-- its page, agi1.app/studio/<id>, where it moves when you type a move's name. And (2026-10-10, the owner's: "they can
-- create a viral content with it … they gonna pay crypto like stables instead of $agi if they hold agi they get a
-- discount") the wallet that made a character can have short videos of it made by an AI video service, paid in USDG.
-- This file gives it what it needs from the database, and the clock that moves its characters (and videos) along every minute.
--
-- Before running it (once, in the Supabase project that SUPABASE_URL points to):
--   • supabase/burns.sql must have been run (burns for messages: the studio shares its ledger of burns, so one burn counts
--     once, for messages OR for a character, never both);
--   • Integrations → Cron and Database → Extensions → pg_net switched on (her buy bot's and her quizzes' already did).
-- Then: SQL Editor → New query → paste all of this → Run. It ends by showing studio_ready = 1 (the database part),
-- studio_scheduled = 1 (the clock) and studio_storage = 1 (the private bucket for the characters' files).
-- It only ADDS tables, functions, a bucket and a cron job (all named agi1_studio… / studio_… / agi1-studio…), and writes to
-- burns.sql's own two tables only what a burn for a character needs (its code, so it never counts twice; its $AGI, so it
-- counts toward the wallet's level like a burn for messages). Running it again changes nothing that's saved.
-- (2026-10-10, AGI Studio at studio.agi1.app: supabase/influencers.sql builds on this file. Since then a character can also
-- be a 3D model made from an influencer's full-body picture, and the bucket takes JPEG pictures and a clip's upload parts:
-- run this file again if it was run before, then influencers.sql.)
--
-- What's kept, and why (only the server's secret key can read or change any of it):
--   agi1_studio_state   one row: a random key, made here once, that the clock sends with each call
--   agi1_studio_orders  per character: a scrambled code of the wallet that ordered it (never its address), its name, its
--                       description and style, the price it was offered at, how it was paid and how much so far, a
--                       scrambled code of each payment's transaction (never the transaction), where it is in the
--                       making (Meshy's task ids), and once done the sizes of its files and its moves. Characters are
--                       public by link, so a done one is kept; one never paid goes after 2 days
--   agi1_studio_videos  per video of a character (2026-10-10, its videos: made by an AI video service from its picture,
--                       paid in USDG only): the same scrambled wallet code, the scene its owner described, its shape and
--                       whether it has sound, its price and what's paid so far, where it is in the making (the video
--                       service's request id and the addresses it gave for it), and once done its file's size. A done one
--                       is kept (public on its character's page); one never paid goes after 2 days
--   agi1_studio_months  per month (UTC): characters paid, paid by burning, and videos paid (the monthly caps)
--   agi1_studio_free    per wallet code and month: its free one (Soulmates)
--   agi1_studio_txs     the scrambled code of each payment counted, for a character or a video (so it counts once)
-- Never an address, a transaction, an IP address or anything else about anyone.

create table if not exists public.agi1_studio_state (
  id  smallint primary key default 1 check (id = 1),
  key text     not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into public.agi1_studio_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.agi1_studio_orders (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  burn_code   text        not null check (char_length(burn_code) between 16 and 64),   -- the wallet's code in burns.sql
  name        text        not null check (char_length(name) between 1 and 24),
  about       text        not null check (char_length(about) between 10 and 400),
  style       text        not null check (style in ('anime', 'cartoon', 'realistic')),
  level       smallint    not null check (level between 1 and 3),
  usd_cents   integer     not null check (usd_cents between 0 and 1000000),          -- the price in USDG, in cents
  agi         bigint      not null check (agi between 0 and 1000000000),             -- the price in burned $AGI
  free        boolean     not null default false,                                    -- a Soulmate's free one is offered
  kind        text        check (kind in ('usdg', 'burn', 'free')),                  -- how it's being paid
  paid        numeric     not null default 0 check (paid >= 0),                      -- so far: cents, or whole $AGI
  status      text        not null default 'quote' check (status in ('quote', 'paid', 'making', 'done', 'failed')),
  paid_at     timestamptz,
  started_at  timestamptz,                                                           -- its making started (this round)
  step        text        check (step in ('preview', 'refine', 'rig', 'moves', 'save')),
  task        text        check (task ~ '^[A-Za-z0-9_-]{6,80}$'),                     -- Meshy's task for that step
  tasks       jsonb       not null default '{}'::jsonb,                              -- each step's task, once done
  tries       smallint    not null default 0 check (tries between 0 and 20),
  error       text        check (char_length(error) <= 200),
  credit      boolean     not null default false,                                    -- failed after payment: try again free
  glb_bytes   integer     check (glb_bytes > 0),
  pic_bytes   integer     check (pic_bytes > 0),
  moves       text[],
  hidden      boolean     not null default false,
  lease_until timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists agi1_studio_orders_due on public.agi1_studio_orders (updated_at) where status in ('paid', 'making');
create index if not exists agi1_studio_orders_wallet on public.agi1_studio_orders (wallet_code, created_at);
create index if not exists agi1_studio_orders_done on public.agi1_studio_orders (done_at) where status = 'done';
create index if not exists agi1_studio_orders_quotes on public.agi1_studio_orders (created_at) where status = 'quote';
-- (2026-10-10, AGI Studio, supabase/influencers.sql) a 3D model made from an influencer's full-body picture: paid in its
-- credits ('credits', or a Soulmate's free one), made by Meshy from that picture (its first step: 'image'), with the
-- influencer it belongs to and the picture it's made from. Columns and rules added to a table that may be there already.
alter table public.agi1_studio_orders add column if not exists inf_id text check (inf_id is null or inf_id ~ '^[A-Za-z0-9_-]{22}$');
alter table public.agi1_studio_orders add column if not exists image_path text
  check (image_path is null or image_path ~ '^inf/[A-Za-z0-9_-]{22}/[A-Za-z0-9_-]{22}-0\.jpg$');
alter table public.agi1_studio_orders drop constraint if exists agi1_studio_orders_step_check;
alter table public.agi1_studio_orders add constraint agi1_studio_orders_step_check
  check (step in ('image', 'preview', 'refine', 'rig', 'moves', 'save'));
alter table public.agi1_studio_orders drop constraint if exists agi1_studio_orders_kind_check;
alter table public.agi1_studio_orders add constraint agi1_studio_orders_kind_check check (kind in ('usdg', 'burn', 'free', 'credits'));
create index if not exists agi1_studio_orders_inf on public.agi1_studio_orders (inf_id, created_at) where inf_id is not null;

create table if not exists public.agi1_studio_months (
  month date    primary key,
  made  integer not null default 0 check (made >= 0),
  burns integer not null default 0 check (burns >= 0)
);
-- (2026-10-10, its videos) the videos paid this month: a column added to a table that may be there already
alter table public.agi1_studio_months add column if not exists videos integer not null default 0 check (videos >= 0);

-- A character's videos (2026-10-10): only a done character's, only made by the wallet that made it
create table if not exists public.agi1_studio_videos (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  char_id     text        not null references public.agi1_studio_orders (id) on delete cascade,
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  scene       text        not null check (char_length(scene) between 10 and 300),
  shape       text        not null check (shape in ('tall', 'wide', 'square')),
  sound       boolean     not null default true,
  level       smallint    not null check (level between 1 and 3),
  usd_cents   integer     not null check (usd_cents between 1 and 1000000),           -- its price in USDG, in cents
  paid        integer     not null default 0 check (paid >= 0),                       -- so far, in cents
  status      text        not null default 'quote' check (status in ('quote', 'paid', 'making', 'done', 'failed')),
  paid_at     timestamptz,
  started_at  timestamptz,                                                            -- its making started (this round)
  req         text        check (req ~ '^[A-Za-z0-9_-]{6,80}$'),                      -- the video service's request id
  status_url  text        check (status_url ~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$'),
  result_url  text        check (result_url ~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$'),
  saving      boolean     not null default false,                                     -- made: its file being kept
  tries       smallint    not null default 0 check (tries between 0 and 20),
  error       text        check (char_length(error) <= 200),
  credit      boolean     not null default false,                                     -- failed after payment: try again free
  bytes       integer     check (bytes > 0),
  hidden      boolean     not null default false,
  lease_until timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists agi1_studio_videos_due on public.agi1_studio_videos (updated_at) where status in ('paid', 'making');
create index if not exists agi1_studio_videos_char on public.agi1_studio_videos (char_id, created_at);
create index if not exists agi1_studio_videos_quotes on public.agi1_studio_videos (created_at) where status = 'quote';

create table if not exists public.agi1_studio_free (
  wallet_code text not null check (char_length(wallet_code) between 16 and 64),
  month       date not null,
  order_id    text not null,
  primary key (wallet_code, month)
);

create table if not exists public.agi1_studio_txs (
  tx_code  text        primary key check (char_length(tx_code) between 16 and 64),
  kind     text        not null check (kind in ('usdg', 'burn')),
  order_id text        not null,
  at       timestamptz not null default now()
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_studio_state enable row level security;
alter table public.agi1_studio_orders enable row level security;
alter table public.agi1_studio_months enable row level security;
alter table public.agi1_studio_free enable row level security;
alter table public.agi1_studio_txs enable row level security;
alter table public.agi1_studio_videos enable row level security;
revoke all on table public.agi1_studio_state, public.agi1_studio_orders, public.agi1_studio_months, public.agi1_studio_free,
  public.agi1_studio_txs, public.agi1_studio_videos from anon, authenticated;

-- The key the clock sends (our server reads it, to check each call really comes from here)
create or replace function public.studio_key()
returns text
language sql
stable
set search_path = public
as $$
  select key from agi1_studio_state where id = 1;
$$;

-- this month (UTC), and the quotes still holding a place: a quote holds one of the month's places for a day, so nobody
-- pays for a character after the month's are gone
create or replace function public.studio_this_month()
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now() at time zone 'utc')::date;
$$;

-- A character's quote: its words (checked by our server), its prices for this wallet (its level's discount), and whether a
-- Soulmate's free one is offered. p_cap: characters a month for the whole site · p_burn_cap: of them, paid by burning ·
-- p_per_wallet: quotes one wallet may hold at once.
-- → {"ok": true, "id", "burn_ok", "free_ok", "left"} or {"ok": false, "why": "bad" | "sold_out" | "too_many" | "taken"}
create or replace function public.studio_quote(p_id text, p_wallet text, p_burn text, p_name text, p_about text, p_style text,
  p_level integer, p_usd_cents integer, p_agi bigint, p_free boolean, p_cap integer, p_burn_cap integer, p_per_wallet integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  m agi1_studio_months%rowtype;
  live integer;
  burn_live integer;
  mine integer;
  free_used boolean;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_burn is null or char_length(p_burn) not between 16 and 64
     or p_name is null or char_length(p_name) not between 1 and 24 or p_about is null or char_length(p_about) not between 10 and 400
     or p_style is null or p_style not in ('anime', 'cartoon', 'realistic') or p_level is null or p_level not between 1 and 3
     or p_usd_cents is null or p_usd_cents not between 0 and 1000000 or p_agi is null or p_agi not between 0 and 1000000000
     or p_free is null or p_cap is null or p_cap not between 1 and 100000 or p_burn_cap is null or p_burn_cap not between 0 and 100000
     or p_per_wallet is null or p_per_wallet not between 1 and 100 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- the month's row first (every function that counts places takes it first, so two quotes never both take the last one)
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  select * into m from agi1_studio_months where month = studio_this_month() for update;
  select count(*) into mine from agi1_studio_orders
    where wallet_code = p_wallet and status = 'quote' and paid = 0 and created_at > now() - interval '1 day';
  if mine >= p_per_wallet then return json_build_object('ok', false, 'why', 'too_many'); end if;
  select count(*), count(*) filter (where kind = 'burn') into live, burn_live from agi1_studio_orders
    where status = 'quote' and created_at > now() - interval '1 day';
  if m.made + live >= p_cap then return json_build_object('ok', false, 'why', 'sold_out'); end if;
  insert into agi1_studio_orders (id, wallet_code, burn_code, name, about, style, level, usd_cents, agi, free)
  values (p_id, p_wallet, p_burn, p_name, p_about, p_style, p_level::smallint, p_usd_cents, p_agi, p_free)
  on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  free_used := exists (select 1 from agi1_studio_free where wallet_code = p_wallet and month = studio_this_month());
  return json_build_object('ok', true, 'id', p_id, 'burn_ok', m.burns + burn_live < p_burn_cap,
    'free_ok', p_free and not free_used, 'left', p_cap - m.made - live - 1);
end;
$$;

-- How it'll be paid: 'usdg' or 'burn' (then the payment, from the wallet's own app: studio_pay), or 'free' (a Soulmate's
-- one this month: paid at once). It can change until a payment is counted. A burn holds one of the month's burn places.
-- → {"ok": true, "kind", "paid": true|false} or {"ok": false, "why": "gone" | "not_yours" | "done" | "burns_sold_out" |
--   "free_used" | "no_free" | "bad"}
create or replace function public.studio_choose(p_id text, p_wallet text, p_kind text, p_burn_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  o agi1_studio_orders%rowtype;
  m agi1_studio_months%rowtype;
  burn_live integer;
begin
  if p_id is null or p_wallet is null or p_kind is null or p_kind not in ('usdg', 'burn', 'free') or p_burn_cap is null then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  select * into m from agi1_studio_months where month = studio_this_month() for update;
  select * into o from agi1_studio_orders where id = p_id for update;
  if not found or (o.status = 'quote' and o.created_at < now() - interval '1 day' and o.paid = 0) then
    return json_build_object('ok', false, 'why', 'gone');
  end if;
  if o.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if o.status <> 'quote' then return json_build_object('ok', false, 'why', 'done'); end if;
  if o.paid > 0 and o.kind is distinct from p_kind then return json_build_object('ok', false, 'why', 'done'); end if;
  if p_kind = 'free' then
    if not o.free then return json_build_object('ok', false, 'why', 'no_free'); end if;
    insert into agi1_studio_free (wallet_code, month, order_id) values (p_wallet, studio_this_month(), p_id)
    on conflict (wallet_code, month) do nothing;
    if not found then return json_build_object('ok', false, 'why', 'free_used'); end if;
    update agi1_studio_orders set kind = 'free', status = 'paid', paid_at = now(), updated_at = now() where id = p_id;
    update agi1_studio_months set made = made + 1 where month = studio_this_month();
    return json_build_object('ok', true, 'kind', 'free', 'paid', true);
  end if;
  if p_kind = 'burn' and o.kind is distinct from 'burn' then
    select count(*) into burn_live from agi1_studio_orders
      where status = 'quote' and kind = 'burn' and created_at > now() - interval '1 day' and id <> p_id;
    if m.burns + burn_live >= p_burn_cap then return json_build_object('ok', false, 'why', 'burns_sold_out'); end if;
  end if;
  update agi1_studio_orders set kind = p_kind, updated_at = now() where id = p_id;
  return json_build_object('ok', true, 'kind', p_kind, 'paid', false);
end;
$$;

-- One payment, read on Robinhood Chain by our server, counted once: p_tx its code · p_amount what it paid toward this
-- character (USDG: cents; a burn: whole $AGI). A burn is also written to burns.sql's own ledger (so it can never count
-- for messages too) and its $AGI to the wallet's (so it counts toward the level, like a burn for messages).
-- Payments add up until the price is reached; then it's paid.
-- → {"ok": true, "paid": true|false, "have", "need"} or {"ok": false, "why": "gone" | "not_yours" | "done" | "used" |
--   "no_kind" | "bad"}
create or replace function public.studio_pay(p_id text, p_wallet text, p_tx text, p_amount numeric)
returns json
language plpgsql
set search_path = public
as $$
declare
  o agi1_studio_orders%rowtype;
  need numeric;
  have numeric;
begin
  if p_id is null or p_wallet is null or p_tx is null or char_length(p_tx) not between 16 and 64
     or p_amount is null or p_amount <= 0 or p_amount > 1000000000 or p_amount <> trunc(p_amount) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  perform 1 from agi1_studio_months where month = studio_this_month() for update;
  select * into o from agi1_studio_orders where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if o.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if o.status <> 'quote' then return json_build_object('ok', false, 'why', 'done'); end if;
  if o.kind is null or o.kind not in ('usdg', 'burn') then return json_build_object('ok', false, 'why', 'no_kind'); end if;
  if o.paid = 0 and o.created_at < now() - interval '1 day' then return json_build_object('ok', false, 'why', 'gone'); end if;
  -- each payment once (two checks of the same payment at once wait for each other here)
  insert into agi1_studio_txs (tx_code, kind, order_id) values (p_tx, o.kind, p_id) on conflict (tx_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'used'); end if;
  if o.kind = 'burn' then
    insert into agi1_burn_txs (tx_code) values (p_tx) on conflict (tx_code) do nothing;
    if not found then
      delete from agi1_studio_txs where tx_code = p_tx;           -- counted for messages already: never twice
      return json_build_object('ok', false, 'why', 'used');
    end if;
    insert into agi1_burn_wallets as b (wallet_code, agi) values (o.burn_code, p_amount)
    on conflict (wallet_code) do update set agi = b.agi + excluded.agi;
  end if;
  need := case when o.kind = 'usdg' then o.usd_cents else o.agi end;
  have := o.paid + p_amount;
  if have >= need then
    update agi1_studio_orders set paid = have, status = 'paid', paid_at = now(), updated_at = now() where id = p_id;
    update agi1_studio_months set made = made + 1, burns = burns + (case when o.kind = 'burn' then 1 else 0 end)
      where month = studio_this_month();
    return json_build_object('ok', true, 'paid', true, 'have', have, 'need', need);
  end if;
  update agi1_studio_orders set paid = have, updated_at = now() where id = p_id;
  return json_build_object('ok', true, 'paid', false, 'have', have, 'need', need);
end;
$$;

-- Which of these payments' codes were counted already (for a character, or a burn for messages): so our server reads only
-- the new ones from the chain (plpgsql: it reads burns.sql's table, which may not be there yet when this file first runs)
create or replace function public.studio_seen(p_txs text[])
returns text[]
language plpgsql
stable
set search_path = public
as $$
begin
  if p_txs is null or cardinality(p_txs) > 50 then return '{}'::text[]; end if;
  return (select coalesce(array_agg(distinct c order by c), '{}'::text[]) from (
    select tx_code as c from agi1_studio_txs where tx_code = any(p_txs)
    union all
    select tx_code from agi1_burn_txs where tx_code = any(p_txs)
  ) s);
end;
$$;

-- A character as our server needs it (the page gets only some of it, from our server)
create or replace function public.studio_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(o) from (
    select id, wallet_code, burn_code, name, about, style, level, usd_cents, agi, free, kind, paid, status, paid_at, started_at, step, task,
      tasks, tries, error, credit, glb_bytes, pic_bytes, moves, hidden, created_at, updated_at, done_at, inf_id, image_path,
      (status = 'quote' and paid = 0 and created_at < now() - interval '1 day') as expired
    from agi1_studio_orders where id = p_id
  ) o;
$$;

-- Its turn in the making, for p_secs seconds: true once (two server copies never move the same character at once)
create or replace function public.studio_lease(p_id text, p_secs integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_secs is null or p_secs not between 5 and 300 then return false; end if;
  update agi1_studio_orders set lease_until = now() + make_interval(secs => p_secs)
  where id = p_id and status in ('paid', 'making') and (lease_until is null or lease_until < now());
  return found;
end;
$$;

-- Where it is in the making: its step, Meshy's task for it, each step's task so far, and its tries; its turn is given back
create or replace function public.studio_step(p_id text, p_step text, p_task text, p_tasks jsonb, p_tries integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_step is null or p_step not in ('image', 'preview', 'refine', 'rig', 'moves', 'save') or (p_task is not null and p_task !~ '^[A-Za-z0-9_-]{6,80}$')
     or p_tasks is null or jsonb_typeof(p_tasks) <> 'object' or p_tries is null or p_tries not between 0 and 20 then
    return false;
  end if;
  -- its first step since it was paid (or tried again) marks when its making started: Meshy keeps what it makes 3 days
  update agi1_studio_orders set status = 'making', step = p_step, task = p_task, tasks = p_tasks, tries = p_tries::smallint,
    started_at = case when status = 'paid' then now() else started_at end, lease_until = null, updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- Its turn given back without a change (still waiting for Meshy), after a 3-second rest: however many pages ask about it,
-- Meshy is asked about it at most once every few seconds
create or replace function public.studio_wait(p_id text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_studio_orders set lease_until = now() + interval '3 seconds' where id = p_id and status in ('paid', 'making') returning true;
$$;

-- Done: its files are kept (their sizes) and its moves (in the order of its file's clips)
create or replace function public.studio_done(p_id text, p_glb integer, p_pic integer, p_moves text[])
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_glb is null or p_glb not between 1 and 100000000 or p_pic is null or p_pic not between 1 and 100000000
     or p_moves is null or cardinality(p_moves) not between 1 and 12 then
    return false;
  end if;
  update agi1_studio_orders set status = 'done', glb_bytes = p_glb, pic_bytes = p_pic, moves = p_moves, step = null, task = null,
    lease_until = null, credit = false, error = null, done_at = now(), updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- It couldn't be made: why (a few words for the page), and whether its owner may try again with new words without paying
-- again (p_credit: it was paid)
create or replace function public.studio_fail(p_id text, p_error text, p_credit boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update agi1_studio_orders set status = 'failed', error = left(coalesce(p_error, 'failed'), 200), credit = coalesce(p_credit, false),
    lease_until = null, task = null, updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- A paid character that couldn't be made, tried again with new words (no new payment, no new place: it has its month's)
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_yours" | "no_credit" | "bad"}
create or replace function public.studio_redo(p_id text, p_wallet text, p_name text, p_about text, p_style text)
returns json
language plpgsql
set search_path = public
as $$
declare
  o agi1_studio_orders%rowtype;
begin
  if p_name is null or char_length(p_name) not between 1 and 24 or p_about is null or char_length(p_about) not between 10 and 400
     or p_style is null or p_style not in ('anime', 'cartoon', 'realistic') then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into o from agi1_studio_orders where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if o.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if o.status <> 'failed' or not o.credit or o.updated_at < now() - interval '30 days' then
    return json_build_object('ok', false, 'why', 'no_credit');
  end if;
  update agi1_studio_orders set name = p_name, about = p_about, style = p_style, status = 'paid', step = null, task = null,
    tasks = '{}'::jsonb, tries = 0, error = null, credit = false, started_at = null, lease_until = null, updated_at = now()
  where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- The characters the clock should move along now (paid or being made, not someone else's turn), the longest-waiting first
create or replace function public.studio_due(p_limit integer)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(id order by updated_at), '{}'::text[]) from (
    select id, updated_at from agi1_studio_orders
    where status in ('paid', 'making') and (lease_until is null or lease_until < now())
    order by updated_at limit least(greatest(coalesce(p_limit, 5), 1), 50)
  ) d;
$$;

-- This month's numbers, for the page: characters paid, paid by burning, and quotes holding a place; videos paid, and video
-- quotes holding a place
create or replace function public.studio_month()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'made', coalesce((select made from agi1_studio_months where month = studio_this_month()), 0),
    'burns', coalesce((select burns from agi1_studio_months where month = studio_this_month()), 0),
    'live', (select count(*) from agi1_studio_orders where status = 'quote' and created_at > now() - interval '1 day'),
    'burn_live', (select count(*) from agi1_studio_orders where status = 'quote' and kind = 'burn' and created_at > now() - interval '1 day'),
    'videos', coalesce((select videos from agi1_studio_months where month = studio_this_month()), 0),
    'video_live', (select count(*) from agi1_studio_videos where status = 'quote' and created_at > now() - interval '1 day'));
$$;

-- Whether this wallet's free one this month is used (Soulmates)
create or replace function public.studio_free_used(p_wallet text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from agi1_studio_free where wallet_code = p_wallet and month = studio_this_month());
$$;

-- The newest characters (done, not hidden), for the studio's gallery: [{ id, name, done_at, moves }]. (2026-10-10) Never a 3D model
-- of an AGI Studio influencer: it's shown on its influencer's own page (one made from a face is never in a gallery).
create or replace function public.studio_list(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'name', name, 'done_at', done_at) order by done_at desc), '[]'::json) from (
    select id, name, done_at from agi1_studio_orders where status = 'done' and not hidden and inf_id is null
    order by done_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)
  ) d;
$$;

-- One wallet's characters (not quotes that went nowhere): [{ id, name, status, credit, created_at }] (an influencer's 3D models:
-- on its own page)
create or replace function public.studio_mine(p_wallet text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'name', name, 'status', status, 'credit', credit, 'created_at', created_at)
    order by created_at desc), '[]'::json) from (
    select id, name, status, credit, created_at from agi1_studio_orders
    where wallet_code = p_wallet and inf_id is null and not (status = 'quote' and paid = 0 and created_at < now() - interval '1 day')
    order by created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) d;
$$;

-- The owner's tool (in the SQL Editor): hide a character from its page and the gallery, or show it again.
-- select studio_hide('<its id>', true);
create or replace function public.studio_hide(p_id text, p_hidden boolean)
returns boolean
language sql
set search_path = public
as $$
  update agi1_studio_orders set hidden = coalesce(p_hidden, true), updated_at = now() where id = p_id returning true;
$$;

-- Tidy-up (the clock, every half hour): quotes never paid go after 2 days, characters (and videos) that failed without a way
-- to try again after 30 days (with credit: after 60), and leases left behind are given back. Done characters and videos stay
-- (their pages are public).
create or replace function public.studio_tidy()
returns json
language plpgsql
set search_path = public
as $$
declare
  quotes integer;
  failed integer;
  video_quotes integer;
  video_failed integer;
begin
  delete from agi1_studio_orders where status = 'quote' and paid = 0 and created_at < now() - interval '2 days';
  get diagnostics quotes = row_count;
  delete from agi1_studio_orders where status = 'failed'
    and ((not credit and updated_at < now() - interval '30 days') or updated_at < now() - interval '60 days');
  get diagnostics failed = row_count;
  update agi1_studio_orders set lease_until = null where lease_until < now() - interval '10 minutes';
  delete from agi1_studio_videos where status = 'quote' and paid = 0 and created_at < now() - interval '2 days';
  get diagnostics video_quotes = row_count;
  delete from agi1_studio_videos where status = 'failed'
    and ((not credit and updated_at < now() - interval '30 days') or updated_at < now() - interval '60 days');
  get diagnostics video_failed = row_count;
  update agi1_studio_videos set lease_until = null where lease_until < now() - interval '10 minutes';
  return json_build_object('quotes', quotes, 'failed', failed, 'video_quotes', video_quotes, 'video_failed', video_failed);
end;
$$;

-- ---------- a character's videos (2026-10-10) ----------
-- A video's quote: a done character's (not hidden), only its own wallet's, the scene (checked by our server), its shape and
-- sound, its price for this wallet (its level's discount). p_cap: videos a month for the whole site · p_per_wallet: video
-- quotes one wallet may hold at once.
-- → {"ok": true, "id", "left"} or {"ok": false, "why": "bad" | "no_char" | "not_yours" | "sold_out" | "too_many" | "taken"}
create or replace function public.studio_video_quote(p_id text, p_char text, p_wallet text, p_scene text, p_shape text, p_sound boolean,
  p_level integer, p_usd_cents integer, p_cap integer, p_per_wallet integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  m agi1_studio_months%rowtype;
  o agi1_studio_orders%rowtype;
  live integer;
  mine integer;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_char is null or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_scene is null or char_length(p_scene) not between 10 and 300 or p_shape is null or p_shape not in ('tall', 'wide', 'square')
     or p_sound is null or p_level is null or p_level not between 1 and 3 or p_usd_cents is null or p_usd_cents not between 1 and 1000000
     or p_cap is null or p_cap not between 1 and 100000 or p_per_wallet is null or p_per_wallet not between 1 and 100 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- the month's row first, as every function that counts places does
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  select * into m from agi1_studio_months where month = studio_this_month() for update;
  select * into o from agi1_studio_orders where id = p_char;
  if not found or o.status <> 'done' or o.hidden then return json_build_object('ok', false, 'why', 'no_char'); end if;
  if o.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  select count(*) into mine from agi1_studio_videos
    where wallet_code = p_wallet and status = 'quote' and paid = 0 and created_at > now() - interval '1 day';
  if mine >= p_per_wallet then return json_build_object('ok', false, 'why', 'too_many'); end if;
  select count(*) into live from agi1_studio_videos where status = 'quote' and created_at > now() - interval '1 day';
  if m.videos + live >= p_cap then return json_build_object('ok', false, 'why', 'sold_out'); end if;
  insert into agi1_studio_videos (id, char_id, wallet_code, scene, shape, sound, level, usd_cents)
  values (p_id, p_char, p_wallet, p_scene, p_shape, p_sound, p_level::smallint, p_usd_cents)
  on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  return json_build_object('ok', true, 'id', p_id, 'left', p_cap - m.videos - live - 1);
end;
$$;

-- One USDG payment toward a video, read on Robinhood Chain by our server, counted once (the same ledger as characters'
-- payments: one payment never pays for two things): p_tx its code · p_amount cents. Payments add up until the price.
-- → {"ok": true, "paid": true|false, "have", "need"} or {"ok": false, "why": "gone" | "not_yours" | "done" | "used" | "bad"}
create or replace function public.studio_video_pay(p_id text, p_wallet text, p_tx text, p_amount integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  v agi1_studio_videos%rowtype;
  have integer;
begin
  if p_id is null or p_wallet is null or p_tx is null or char_length(p_tx) not between 16 and 64
     or p_amount is null or p_amount <= 0 or p_amount > 10000000 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  perform 1 from agi1_studio_months where month = studio_this_month() for update;
  select * into v from agi1_studio_videos where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if v.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if v.status <> 'quote' then return json_build_object('ok', false, 'why', 'done'); end if;
  if v.paid = 0 and v.created_at < now() - interval '1 day' then return json_build_object('ok', false, 'why', 'gone'); end if;
  insert into agi1_studio_txs (tx_code, kind, order_id) values (p_tx, 'usdg', p_id) on conflict (tx_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'used'); end if;
  have := v.paid + p_amount;
  if have >= v.usd_cents then
    update agi1_studio_videos set paid = have, status = 'paid', paid_at = now(), updated_at = now() where id = p_id;
    update agi1_studio_months set videos = videos + 1 where month = studio_this_month();
    return json_build_object('ok', true, 'paid', true, 'have', have, 'need', v.usd_cents);
  end if;
  update agi1_studio_videos set paid = have, updated_at = now() where id = p_id;
  return json_build_object('ok', true, 'paid', false, 'have', have, 'need', v.usd_cents);
end;
$$;

-- A video as our server needs it, with its character's name, style and state (the page gets only some of it)
create or replace function public.studio_video_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(x) from (
    select v.id, v.char_id, v.wallet_code, v.scene, v.shape, v.sound, v.level, v.usd_cents, v.paid, v.status, v.paid_at, v.started_at,
      v.req, v.status_url, v.result_url, v.saving, v.tries, v.error, v.credit, v.bytes, v.hidden, v.created_at, v.updated_at, v.done_at,
      (v.status = 'quote' and v.paid = 0 and v.created_at < now() - interval '1 day') as expired,
      o.name as char_name, o.style as char_style, o.status as char_status, o.hidden as char_hidden
    from agi1_studio_videos v join agi1_studio_orders o on o.id = v.char_id
    where v.id = p_id
  ) x;
$$;

-- Its turn in the making, for p_secs seconds: true once (two server copies never move the same video at once)
create or replace function public.studio_video_lease(p_id text, p_secs integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_secs is null or p_secs not between 5 and 300 then return false; end if;
  update agi1_studio_videos set lease_until = now() + make_interval(secs => p_secs)
  where id = p_id and status in ('paid', 'making') and (lease_until is null or lease_until < now());
  return found;
end;
$$;

-- Where it is in the making: the video service's request (its id and the addresses it gave for its state and its result:
-- only ever on queue.fal.run), whether it's being kept, its tries; its turn is given back
create or replace function public.studio_video_step(p_id text, p_req text, p_status_url text, p_result_url text, p_saving boolean, p_tries integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if (p_req is not null and p_req !~ '^[A-Za-z0-9_-]{6,80}$')
     or (p_status_url is not null and p_status_url !~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$')
     or (p_result_url is not null and p_result_url !~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$')
     or p_saving is null or p_tries is null or p_tries not between 0 and 20 then
    return false;
  end if;
  update agi1_studio_videos set status = 'making', req = p_req, status_url = p_status_url, result_url = p_result_url, saving = p_saving,
    tries = p_tries::smallint, started_at = case when status = 'paid' then now() else started_at end, lease_until = null, updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- Its turn given back without a change (still being made), after a 3-second rest
create or replace function public.studio_video_wait(p_id text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_studio_videos set lease_until = now() + interval '3 seconds' where id = p_id and status in ('paid', 'making') returning true;
$$;

-- Done: its file is kept (its size); the video service's addresses are forgotten
create or replace function public.studio_video_done(p_id text, p_bytes integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_bytes is null or p_bytes not between 1 and 100000000 then return false; end if;
  update agi1_studio_videos set status = 'done', bytes = p_bytes, saving = false, status_url = null, result_url = null,
    lease_until = null, credit = false, error = null, done_at = now(), updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- It couldn't be made: why (a few words for the page), and whether its owner may try again with new words (p_credit: paid)
create or replace function public.studio_video_fail(p_id text, p_error text, p_credit boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update agi1_studio_videos set status = 'failed', error = left(coalesce(p_error, 'failed'), 200), credit = coalesce(p_credit, false),
    saving = false, lease_until = null, updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- A paid video that couldn't be made, tried again with a new scene (no new payment, no new place: it has its month's)
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_yours" | "no_credit" | "no_char" | "bad"}
create or replace function public.studio_video_redo(p_id text, p_wallet text, p_scene text, p_shape text, p_sound boolean)
returns json
language plpgsql
set search_path = public
as $$
declare
  v agi1_studio_videos%rowtype;
begin
  if p_scene is null or char_length(p_scene) not between 10 and 300 or p_shape is null or p_shape not in ('tall', 'wide', 'square')
     or p_sound is null then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into v from agi1_studio_videos where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if v.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if v.status <> 'failed' or not v.credit or v.updated_at < now() - interval '30 days' then
    return json_build_object('ok', false, 'why', 'no_credit');
  end if;
  if not exists (select 1 from agi1_studio_orders where id = v.char_id and status = 'done' and not hidden) then
    return json_build_object('ok', false, 'why', 'no_char');
  end if;
  update agi1_studio_videos set scene = p_scene, shape = p_shape, sound = p_sound, status = 'paid', req = null, status_url = null,
    result_url = null, saving = false, tries = 0, error = null, credit = false, started_at = null, lease_until = null, updated_at = now()
  where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- The videos the clock should move along now (paid or being made, not someone else's turn), the longest-waiting first
create or replace function public.studio_video_due(p_limit integer)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(id order by updated_at), '{}'::text[]) from (
    select id, updated_at from agi1_studio_videos
    where status in ('paid', 'making') and (lease_until is null or lease_until < now())
    order by updated_at limit least(greatest(coalesce(p_limit, 4), 1), 50)
  ) d;
$$;

-- A character's videos: the done ones (not hidden) for everyone, and (p_wallet: its own wallet's code) its own wallet's
-- others too (waiting for payment, being made, failed), the newest first
create or replace function public.studio_video_list(p_char text, p_wallet text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'scene', scene, 'shape', shape, 'sound', sound, 'status', status,
      'step', case when saving then 'save' when req is not null then 'make' else 'queue' end,
      'credit', credit, 'error', error, 'usd_cents', usd_cents, 'paid', paid, 'level', level, 'bytes', bytes,
      'created_at', created_at, 'done_at', done_at, 'mine', coalesce(wallet_code = p_wallet, false))
      order by coalesce(done_at, created_at) desc), '[]'::json)
  from (
    select v.* from agi1_studio_videos v join agi1_studio_orders o on o.id = v.char_id
    where v.char_id = p_char and not o.hidden
      and ((v.status = 'done' and not v.hidden)
        or (p_wallet is not null and v.wallet_code = p_wallet and v.status <> 'done'
          and not (v.status = 'quote' and v.paid = 0 and v.created_at < now() - interval '1 day')))
    order by coalesce(v.done_at, v.created_at) desc
    limit least(greatest(coalesce(p_limit, 24), 1), 60)
  ) d;
$$;

-- The owner's tool (in the SQL Editor): hide a video from its character's page, or show it again.
-- select studio_video_hide('<its id>', true);
create or replace function public.studio_video_hide(p_id text, p_hidden boolean)
returns boolean
language sql
set search_path = public
as $$
  update agi1_studio_videos set hidden = coalesce(p_hidden, true), updated_at = now() where id = p_id returning true;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.studio_key() from public, anon, authenticated;
revoke all on function public.studio_this_month() from public, anon, authenticated;
revoke all on function public.studio_quote(text, text, text, text, text, text, integer, integer, bigint, boolean, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.studio_choose(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.studio_pay(text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.studio_seen(text[]) from public, anon, authenticated;
revoke all on function public.studio_get(text) from public, anon, authenticated;
revoke all on function public.studio_lease(text, integer) from public, anon, authenticated;
revoke all on function public.studio_step(text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.studio_wait(text) from public, anon, authenticated;
revoke all on function public.studio_done(text, integer, integer, text[]) from public, anon, authenticated;
revoke all on function public.studio_fail(text, text, boolean) from public, anon, authenticated;
revoke all on function public.studio_redo(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.studio_due(integer) from public, anon, authenticated;
revoke all on function public.studio_month() from public, anon, authenticated;
revoke all on function public.studio_free_used(text) from public, anon, authenticated;
revoke all on function public.studio_list(integer) from public, anon, authenticated;
revoke all on function public.studio_mine(text, integer) from public, anon, authenticated;
revoke all on function public.studio_hide(text, boolean) from public, anon, authenticated;
revoke all on function public.studio_tidy() from public, anon, authenticated;
revoke all on function public.studio_video_quote(text, text, text, text, text, boolean, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.studio_video_pay(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.studio_video_get(text) from public, anon, authenticated;
revoke all on function public.studio_video_lease(text, integer) from public, anon, authenticated;
revoke all on function public.studio_video_step(text, text, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.studio_video_wait(text) from public, anon, authenticated;
revoke all on function public.studio_video_done(text, integer) from public, anon, authenticated;
revoke all on function public.studio_video_fail(text, text, boolean) from public, anon, authenticated;
revoke all on function public.studio_video_redo(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.studio_video_due(integer) from public, anon, authenticated;
revoke all on function public.studio_video_list(text, text, integer) from public, anon, authenticated;
revoke all on function public.studio_video_hide(text, boolean) from public, anon, authenticated;
grant execute on function public.studio_key() to service_role;
grant execute on function public.studio_this_month() to service_role;
grant execute on function public.studio_quote(text, text, text, text, text, text, integer, integer, bigint, boolean, integer, integer, integer) to service_role;
grant execute on function public.studio_choose(text, text, text, integer) to service_role;
grant execute on function public.studio_pay(text, text, text, numeric) to service_role;
grant execute on function public.studio_seen(text[]) to service_role;
grant execute on function public.studio_get(text) to service_role;
grant execute on function public.studio_lease(text, integer) to service_role;
grant execute on function public.studio_step(text, text, text, jsonb, integer) to service_role;
grant execute on function public.studio_wait(text) to service_role;
grant execute on function public.studio_done(text, integer, integer, text[]) to service_role;
grant execute on function public.studio_fail(text, text, boolean) to service_role;
grant execute on function public.studio_redo(text, text, text, text, text) to service_role;
grant execute on function public.studio_due(integer) to service_role;
grant execute on function public.studio_month() to service_role;
grant execute on function public.studio_free_used(text) to service_role;
grant execute on function public.studio_list(integer) to service_role;
grant execute on function public.studio_mine(text, integer) to service_role;
grant execute on function public.studio_hide(text, boolean) to service_role;
grant execute on function public.studio_tidy() to service_role;
grant execute on function public.studio_video_quote(text, text, text, text, text, boolean, integer, integer, integer, integer) to service_role;
grant execute on function public.studio_video_pay(text, text, text, integer) to service_role;
grant execute on function public.studio_video_get(text) to service_role;
grant execute on function public.studio_video_lease(text, integer) to service_role;
grant execute on function public.studio_video_step(text, text, text, text, boolean, integer) to service_role;
grant execute on function public.studio_video_wait(text) to service_role;
grant execute on function public.studio_video_done(text, integer) to service_role;
grant execute on function public.studio_video_fail(text, text, boolean) to service_role;
grant execute on function public.studio_video_redo(text, text, text, text, boolean) to service_role;
grant execute on function public.studio_video_due(integer) to service_role;
grant execute on function public.studio_video_list(text, text, integer) to service_role;
grant execute on function public.studio_video_hide(text, boolean) to service_role;

-- The characters' files: a private bucket in Supabase Storage (only our server's secret key can read or write it; the
-- pages get a character's files from our own address, /api/launch?studio-file=…, and its videos too, /api/launch?studio-
-- video=…, downloaded through a short-lived signed address our server makes). 40 MB a file at most, only a 3D model (GLB),
-- pictures (WebP, PNG; since AGI Studio, 2026-10-10, JPEG too), videos (MP4) and the parts of a clip being uploaded to AGI
-- Studio (application/octet-stream, put together by our server). Only when Supabase Storage is there (it always is in a
-- Supabase project).
do $do$
begin
  if to_regclass('storage.buckets') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
      execute $q$insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values ('agi1-characters', 'agi1-characters', false, 41943040,
          array['model/gltf-binary', 'image/webp', 'image/png', 'image/jpeg', 'video/mp4', 'application/octet-stream'])
        on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types$q$;
    else
      execute $q$insert into storage.buckets (id, name, public) values ('agi1-characters', 'agi1-characters', false)
        on conflict (id) do update set public = false$q$;
    end if;
  else
    raise notice 'Supabase Storage is not here (storage.buckets): the characters'' files have nowhere to go';
  end if;
end
$do$;

-- The clock: every minute, Supabase Cron calls our site's studio with the key (pg_net, an HTTPS request; nothing else is
-- sent): it moves the characters being made along (Meshy's steps, then their files kept), and their videos, and tidies up.
-- Only when both switches above are on.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('agi1-studio', '* * * * *', $cmd$
      select net.http_get(
        url := 'https://www.agi1.app/api/feed?studio',
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select key from public.agi1_studio_state where id = 1)),
        timeout_milliseconds := 25000
      );
    $cmd$);
  else
    raise notice 'The studio''s clock is not set yet: switch on Integrations → Cron (pg_cron) and Database → Extensions → pg_net, then run this file again';
  end if;
  if to_regclass('public.agi1_burn_txs') is null or to_regclass('public.agi1_burn_wallets') is null then
    raise notice 'supabase/burns.sql has not been run: run it first (the studio shares its ledger of burns), then this file again';
  end if;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: studio_ready = 1 (its 32 functions: 20 for characters, 12 for their videos; and burns.sql's two tables it shares),
-- studio_scheduled = 1 (the clock, every minute), studio_storage = 1 (the private bucket for the characters' files).
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('studio_key', 'studio_this_month',
    'studio_quote', 'studio_choose', 'studio_pay', 'studio_seen', 'studio_get', 'studio_lease', 'studio_step', 'studio_wait',
    'studio_done', 'studio_fail', 'studio_redo', 'studio_due', 'studio_month', 'studio_free_used', 'studio_list', 'studio_mine',
    'studio_hide', 'studio_tidy', 'studio_video_quote', 'studio_video_pay', 'studio_video_get', 'studio_video_lease',
    'studio_video_step', 'studio_video_wait', 'studio_video_done', 'studio_video_fail', 'studio_video_redo', 'studio_video_due',
    'studio_video_list', 'studio_video_hide')) / 32
    * (case when to_regclass('public.agi1_burn_txs') is not null and to_regclass('public.agi1_burn_wallets') is not null then 1 else 0 end)
    as studio_ready,
  (select count(*) from pg_extension where extname = 'pg_cron') * (select count(*) from pg_extension where extname = 'pg_net') as studio_scheduled,
  (case when to_regclass('storage.buckets') is not null then 1 else 0 end) as studio_storage;
