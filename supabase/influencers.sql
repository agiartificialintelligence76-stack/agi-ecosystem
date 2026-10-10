-- AGI Studio, the AI influencer app (2026-10-10, the owner: "in making the 3c character, why i cant upload a refetence just
-- like the meshy and wheres the trending video? , i i want it sopmething likehiggsfield ai influencer you know that right and
-- like higgsfield genjuts and then they can launch a token with it on clank and aan you make it studio.agi1.app , the ui will
-- be different on this it will be user friendly and easy to use"; the owner's choices: their own face too, a 2D influencer
-- with 3D as an extra, trend moves from our presets and their own clips, Kling V3 Standard for trend videos, credits bought
-- with USDG, holder discounts and free credits a month, the trend moves made once with AI).
-- At studio.agi1.app (and agi1.app/studio) someone 18+ with a connected wallet makes an AI influencer three ways (designed
-- from a few choices, from a picture of a character, or from their own face with a live selfie and their consent): 4 looks
-- to pick from, then its full-body picture. Then its photos in any scene, trend videos (a move from our presets or their own
-- clip), scene videos, a 3D model (supabase/studio.sql's characters) and a coin on clank.trade with its face (Launch with
-- AGI-1's drafts). Everything is paid in credits, bought with USDG from the person's OWN wallet app (1 credit = 1 cent).
-- This file gives it what it needs from the database. Our server does the rest (server/influencer.js, server/credits.js).
--
-- Before running it (once, in the Supabase project that SUPABASE_URL points to):
--   • supabase/burns.sql and supabase/studio.sql must have been run, studio.sql in its version of 2026-10-10 (with AGI Studio:
--     run it again if it was run before): this file shares its payment ledger, its months, its bucket and its clock.
-- Then: SQL Editor → New query → paste all of this → Run. It ends by showing influencers_ready = 1.
-- It only ADDS tables and functions (all named agi1_inf… / agi1_credit… / inf_… / trend_…), and writes to studio.sql's tables
-- only what a 3D model from an influencer and a credits top-up need. Running it again changes nothing that's saved.
--
-- What's kept, and why (only the server's secret key can read or change any of it):
--   agi1_inf            per influencer: a scrambled code of its wallet (never the address), its name, how it was made (designed,
--                       from a picture, or from the person's face), its style and the choices it was designed with, the
--                       upload it was made from (only until it's made: then the upload is deleted), which of its looks was
--                       picked, and whether it's shown in Explore (never one made from a face) or hidden by the owner
--   agi1_inf_jobs       each picture or video made for it (its looks, its full body, its photos, trend and scene videos; and
--                       the owner's trend moves): its words, shape and sound, the credits it cost, where it is at the AI
--                       service (its request id and the addresses it gave), and once done its files' count and size
--   agi1_credits        per wallet code: its credits (bought, and this month's free ones)
--   agi1_credit_log     each top-up, spend, refund and free grant (its wallet code, the amount, what it was for)
--   agi1_credit_months  per month: the free credits given out (the whole site's cap)
--   agi1_inf_uploads    each picture, selfie or clip uploaded: its wallet code, its kind, whether the AI check passed it, a
--                       clip's length (the files are deleted within 2 days, a selfie or picture as soon as its influencer is
--                       made)
--   agi1_inf_trends     the trend moves (the owner's): their state and their video's job
--   agi1_inf_reports    reports of an influencer or one of its videos: why, and a daily code of who reported (never an IP)
--   agi1_inf_days       per day: the AI jobs started (the whole site's cap)
-- Never an address, a transaction, an IP address or anything else about anyone.

-- studio.sql first (its version of 2026-10-10): this file builds on its tables, its months and its payment ledger
do $do$
begin
  if to_regclass('public.agi1_studio_orders') is null or to_regclass('public.agi1_studio_txs') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_studio_orders'
       and column_name = 'image_path') then
    raise exception 'Run supabase/studio.sql first (its version of 2026-10-10, with AGI Studio), then this file again';
  end if;
end
$do$;

create table if not exists public.agi1_inf (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  name        text        not null check (char_length(name) between 1 and 24),
  mode        text        not null check (mode in ('design', 'picture', 'face')),
  style       text        not null check (style in ('real', 'anime', 'toon')),
  settings    jsonb       not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  words       text        not null default '' check (char_length(words) <= 200),
  source      text        check (source ~ '^[A-Za-z0-9_-]{22}$'),                  -- its upload (a picture or a selfie)
  status      text        not null default 'looks' check (status in ('looks', 'pick', 'body', 'ready', 'failed', 'deleted')),
  first_job   text        check (first_job ~ '^[A-Za-z0-9_-]{22}$'),               -- its first looks (its creation's credits)
  looks_job   text        check (looks_job ~ '^[A-Za-z0-9_-]{22}$'),               -- the looks shown to pick from
  pick        smallint    check (pick between 0 and 3),
  body_job    text        check (body_job ~ '^[A-Za-z0-9_-]{22}$'),                -- its full-body picture
  body_tries  smallint    not null default 0 check (body_tries between 0 and 20),
  error       text        check (char_length(error) <= 200),
  public      boolean     not null default true,
  hidden      boolean     not null default false,
  level       smallint    not null check (level between 1 and 3),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  ready_at    timestamptz
);
create index if not exists agi1_inf_wallet on public.agi1_inf (wallet_code, created_at);
create index if not exists agi1_inf_ready on public.agi1_inf (ready_at) where status = 'ready' and public and not hidden;

create table if not exists public.agi1_inf_jobs (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  inf_id      text        references public.agi1_inf (id) on delete cascade,
  wallet_code text        check (char_length(wallet_code) between 16 and 64),
  kind        text        not null check (kind in ('looks', 'body', 'photo', 'trend', 'video', 'preset')),
  scene       text        check (char_length(scene) between 1 and 300),
  shape       text        check (shape in ('tall', 'wide', 'square')),
  sound       boolean     not null default false,
  trend       text        check (trend ~ '^[a-z][a-z0-9-]{1,30}$'),
  clip        text        check (clip ~ '^[A-Za-z0-9_-]{22}$'),
  image       text        check (image ~ '^[A-Za-z0-9_-]{22}$'),                   -- a video from one of its photos (else its full body)
  pick        smallint    check (pick between 0 and 3),                             -- a full body: the look it's made from
  cost        integer     not null default 0 check (cost between 0 and 100000),
  status      text        not null default 'paid' check (status in ('paid', 'making', 'done', 'failed')),
  req         text        check (req ~ '^[A-Za-z0-9_-]{6,80}$'),
  status_url  text        check (status_url ~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$'),
  result_url  text        check (result_url ~ '^https://queue\.fal\.run/[A-Za-z0-9._/-]{1,240}$'),
  saving      boolean     not null default false,
  tries       smallint    not null default 0 check (tries between 0 and 20),
  error       text        check (char_length(error) <= 200),
  refunded    boolean     not null default false,
  files       smallint    not null default 0 check (files between 0 and 4),
  bytes       integer     check (bytes > 0),
  poster      boolean     not null default false,
  hidden      boolean     not null default false,
  lease_until timestamptz,
  started_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz,
  check ((kind = 'preset') = (inf_id is null))
);
create index if not exists agi1_inf_jobs_due on public.agi1_inf_jobs (updated_at) where status in ('paid', 'making');
create index if not exists agi1_inf_jobs_inf on public.agi1_inf_jobs (inf_id, created_at);
create index if not exists agi1_inf_jobs_fresh on public.agi1_inf_jobs (done_at) where status = 'done' and kind in ('trend', 'video');

create table if not exists public.agi1_credits (
  wallet_code text        primary key check (char_length(wallet_code) between 16 and 64),
  paid        integer     not null default 0 check (paid between 0 and 100000000),       -- bought (they never run out)
  free        integer     not null default 0 check (free between 0 and 100000),          -- this month's free ones
  free_month  date,                                                                       -- the month they're for
  updated_at  timestamptz not null default now()
);

create table if not exists public.agi1_credit_log (
  id          bigint      generated always as identity primary key,
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  kind        text        not null check (kind in ('topup', 'spend', 'refund', 'free')),
  amount      integer     not null check (amount between 0 and 100000000),
  paid_part   integer     not null default 0 check (paid_part >= 0),
  free_part   integer     not null default 0 check (free_part >= 0),
  month       date        not null default (date_trunc('month', now() at time zone 'utc')::date),
  ref         text        not null check (char_length(ref) between 1 and 80),
  at          timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists agi1_credit_log_wallet on public.agi1_credit_log (wallet_code, at);

create table if not exists public.agi1_credit_months (
  month      date    primary key,
  free_given integer not null default 0 check (free_given >= 0)
);

create table if not exists public.agi1_inf_uploads (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  kind        text        not null check (kind in ('picture', 'face', 'clip')),
  status      text        not null default 'open' check (status in ('open', 'ok', 'refused', 'used')),
  why         text        check (char_length(why) <= 40),
  seconds     numeric     check (seconds > 0 and seconds <= 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists agi1_inf_uploads_wallet on public.agi1_inf_uploads (wallet_code, created_at);

create table if not exists public.agi1_inf_trends (
  id          text        primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  status      text        not null default 'making' check (status in ('making', 'review', 'kept', 'hidden', 'failed')),
  job         text        check (job ~ '^[A-Za-z0-9_-]{22}$'),
  sort        smallint    not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.agi1_inf_reports (
  id         bigint      generated always as identity primary key,
  inf_id     text        not null check (inf_id ~ '^[A-Za-z0-9_-]{22}$'),
  job_id     text        check (job_id ~ '^[A-Za-z0-9_-]{22}$'),
  why        text        not null check (why in ('real_person', 'minor', 'sexual', 'hate', 'violence', 'copyright', 'other')),
  who        text        not null check (char_length(who) between 16 and 64),
  day        date        not null default ((now() at time zone 'utc')::date),
  at         timestamptz not null default now()
);
create unique index if not exists agi1_inf_reports_once on public.agi1_inf_reports (who, inf_id, coalesce(job_id, ''), day);

create table if not exists public.agi1_inf_days (
  day  date    primary key,
  jobs integer not null default 0 check (jobs >= 0)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_inf enable row level security;
alter table public.agi1_inf_jobs enable row level security;
alter table public.agi1_credits enable row level security;
alter table public.agi1_credit_log enable row level security;
alter table public.agi1_credit_months enable row level security;
alter table public.agi1_inf_uploads enable row level security;
alter table public.agi1_inf_trends enable row level security;
alter table public.agi1_inf_reports enable row level security;
alter table public.agi1_inf_days enable row level security;
revoke all on table public.agi1_inf, public.agi1_inf_jobs, public.agi1_credits, public.agi1_credit_log, public.agi1_credit_months,
  public.agi1_inf_uploads, public.agi1_inf_trends, public.agi1_inf_reports, public.agi1_inf_days from anon, authenticated;

-- ---------- credits ----------
-- A wallet's credits now: { paid (bought), free (this month's), month }
create or replace function public.inf_credits(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('paid', coalesce(c.paid, 0),
    'free', case when c.free_month = studio_this_month() then c.free else 0 end, 'month', studio_this_month())
  from (select 1) one left join agi1_credits c on c.wallet_code = p_wallet;
$$;

-- Credits spent on something (p_ref: its job's or 3D model's id): this month's free ones first, then bought ones. Once per
-- p_ref. → {"ok": true, "paid", "free"} or {"ok": false, "why": "short" (with what it has) | "taken" | "bad"}
create or replace function public.inf_spend(p_wallet text, p_cost integer, p_ref text)
returns json
language plpgsql
set search_path = public
as $$
declare
  c agi1_credits%rowtype;
  m date := studio_this_month();
  f integer;
  fp integer;
  pp integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_cost is null or p_cost not between 0 and 100000
     or p_ref is null or char_length(p_ref) not between 1 and 80 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  select * into c from agi1_credits where wallet_code = p_wallet for update;
  f := case when c.free_month = m then c.free else 0 end;
  if f + c.paid < p_cost then
    return json_build_object('ok', false, 'why', 'short', 'paid', c.paid, 'free', f);
  end if;
  fp := least(f, p_cost);
  pp := p_cost - fp;
  begin
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, month, ref)
    values (p_wallet, 'spend', p_cost, pp, fp, m, p_ref);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  update agi1_credits set paid = paid - pp, free = f - fp, updated_at = now() where wallet_code = p_wallet;
  return json_build_object('ok', true, 'paid', c.paid - pp, 'free', f - fp);
end;
$$;

-- What was spent on p_ref, given back once: bought credits always, this month's free ones only while it's still that month
-- (they'd have run out anyway). → true (given back) or false (nothing spent on it, or given back already)
create or replace function public.inf_refund(p_ref text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  l agi1_credit_log%rowtype;
  m date := studio_this_month();
  back_free integer;
begin
  select * into l from agi1_credit_log where kind = 'spend' and ref = p_ref;
  if not found then return false; end if;
  back_free := case when l.month = m then l.free_part else 0 end;
  begin
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, month, ref)
    values (l.wallet_code, 'refund', l.paid_part + back_free, l.paid_part, back_free, m, p_ref);
  exception when unique_violation then
    return false;
  end;
  update agi1_credits set paid = paid + l.paid_part,
    free = case when free_month = m then free + back_free else free end, updated_at = now()
  where wallet_code = l.wallet_code;
  return true;
end;
$$;

-- A USDG payment read on Robinhood Chain by our server (p_tx: its code, the same ledger as the studio's payments, so one
-- payment never counts twice; p_cents: what it paid, in cents), turned into as many credits.
-- → {"ok": true, "paid"} or {"ok": false, "why": "used" | "bad"}
create or replace function public.inf_topup(p_wallet text, p_tx text, p_cents integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  v integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_tx is null or char_length(p_tx) not between 16 and 64
     or p_cents is null or p_cents not between 1 and 10000000 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_studio_txs (tx_code, kind, order_id) values (p_tx, 'usdg', 'credits') on conflict (tx_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'used'); end if;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  update agi1_credits set paid = least(paid + p_cents, 100000000), updated_at = now() where wallet_code = p_wallet returning paid into v;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, ref) values (p_wallet, 'topup', p_cents, p_cents, 0, p_tx);
  return json_build_object('ok', true, 'paid', v);
end;
$$;

-- This month's free credits for a holder (p_amount by its level: our server's FREE_CREDITS), once a month per wallet, while
-- the whole site's free credits this month (p_cap) last. They run out at the month's end.
-- → {"granted": true, "free"} or {"granted": false, "why": "level" | "done" (given already) | "cap" | "bad", "free"}
create or replace function public.inf_free(p_wallet text, p_amount integer, p_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  c agi1_credits%rowtype;
  mo agi1_credit_months%rowtype;
  m date := studio_this_month();
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_cap is null or p_cap < 0 then
    return json_build_object('granted', false, 'why', 'bad', 'free', 0);
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then return json_build_object('granted', false, 'why', 'level', 'free', 0); end if;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  select * into c from agi1_credits where wallet_code = p_wallet for update;
  if c.free_month = m then return json_build_object('granted', false, 'why', 'done', 'free', c.free); end if;
  insert into agi1_credit_months (month) values (m) on conflict (month) do nothing;
  select * into mo from agi1_credit_months where month = m for update;
  if mo.free_given + p_amount > p_cap then return json_build_object('granted', false, 'why', 'cap', 'free', 0); end if;
  update agi1_credits set free = p_amount, free_month = m, updated_at = now() where wallet_code = p_wallet;
  update agi1_credit_months set free_given = free_given + p_amount where month = m;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, month, ref)
  values (p_wallet, 'free', p_amount, 0, p_amount, m, to_char(m, 'YYYY-MM') || ':' || p_wallet) on conflict (kind, ref) do nothing;
  return json_build_object('granted', true, 'free', p_amount);
end;
$$;

-- ---------- uploads (a picture, a selfie, a clip) ----------
-- A new upload, before its file comes (p_per_day: uploads one wallet may start a day).
-- → {"ok": true} or {"ok": false, "why": "too_many" | "bad" | "taken"}
create or replace function public.inf_upload_open(p_id text, p_wallet text, p_kind text, p_per_day integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_kind is null or p_kind not in ('picture', 'face', 'clip') or p_per_day is null or p_per_day < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-upload:' || p_wallet));
  if (select count(*) from agi1_inf_uploads where wallet_code = p_wallet and created_at > now() - interval '1 day') >= p_per_day then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_uploads (id, wallet_code, kind) values (p_id, p_wallet, p_kind) on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.inf_upload_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(u) from (select id, wallet_code, kind, status, why, seconds, created_at from agi1_inf_uploads where id = p_id) u;
$$;

-- Its file is in and checked: 'ok' (it may be used) or 'refused' (why: the AI check's reason); a clip's length
create or replace function public.inf_upload_set(p_id text, p_status text, p_why text, p_seconds numeric)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_status is null or p_status not in ('ok', 'refused') or (p_seconds is not null and (p_seconds <= 0 or p_seconds > 60)) then
    return false;
  end if;
  update agi1_inf_uploads set status = p_status, why = left(p_why, 40), seconds = coalesce(p_seconds, seconds), updated_at = now()
  where id = p_id and status in ('open', 'ok');
  return found;
end;
$$;

-- ---------- influencers ----------
-- One more AI job today for the whole site (p_day_cap): true while there's room (counted), false when the day's are used
create or replace function public.inf_day_take(p_day_cap integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  d agi1_inf_days%rowtype;
begin
  insert into agi1_inf_days (day) values (today) on conflict (day) do nothing;
  select * into d from agi1_inf_days where day = today for update;
  if d.jobs >= coalesce(p_day_cap, 0) then return false; end if;
  update agi1_inf_days set jobs = jobs + 1 where day = today;
  return true;
end;
$$;

-- A new influencer (its words and choices checked by our server): its credits spent, its first looks started.
-- p_mode 'picture' or 'face' needs its upload (p_source: this wallet's, of that kind, passed by the AI check). p_per_wallet:
-- influencers one wallet may have being made at once · p_day_cap: AI jobs a day for the whole site.
-- → {"ok": true, "paid", "free"} or {"ok": false, "why": "short" | "source" | "too_many" | "busy_day" | "taken" | "bad"}
create or replace function public.inf_start(p_id text, p_job text, p_wallet text, p_name text, p_mode text, p_style text,
  p_settings jsonb, p_words text, p_source text, p_level integer, p_cost integer, p_per_wallet integer, p_day_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  u agi1_inf_uploads%rowtype;
  s json;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' or p_id = p_job
     or p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_name is null or char_length(p_name) not between 1 and 24
     or p_mode is null or p_mode not in ('design', 'picture', 'face') or p_style is null or p_style not in ('real', 'anime', 'toon')
     or p_settings is null or jsonb_typeof(p_settings) <> 'object' or char_length(coalesce(p_words, '')) > 200
     or p_level is null or p_level not between 1 and 3 or p_cost is null or p_cost not between 0 and 100000
     or p_per_wallet is null or p_per_wallet < 1 or p_day_cap is null or p_day_cap < 1
     or (p_mode = 'design') <> (p_source is null) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  if p_source is not null then
    select * into u from agi1_inf_uploads where id = p_source for update;
    if not found or u.wallet_code <> p_wallet or u.kind <> p_mode or u.status <> 'ok' then
      return json_build_object('ok', false, 'why', 'source');
    end if;
  end if;
  if (select count(*) from agi1_inf where wallet_code = p_wallet and status in ('looks', 'pick', 'body')) >= p_per_wallet then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  begin
    if not inf_day_take(p_day_cap) then return json_build_object('ok', false, 'why', 'busy_day'); end if;
    if p_cost > 0 then
      s := inf_spend(p_wallet, p_cost, p_job);
      if (s ->> 'ok')::boolean is not true then
        raise exception using errcode = 'P0001', message = coalesce(s ->> 'why', 'busy');
      end if;
    else
      s := inf_credits(p_wallet);
    end if;
    insert into agi1_inf (id, wallet_code, name, mode, style, settings, words, source, status, first_job, public, level)
    values (p_id, p_wallet, p_name, p_mode, p_style, p_settings, coalesce(p_words, ''), p_source, 'looks', p_job, p_mode <> 'face', p_level);
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, cost) values (p_job, p_id, p_wallet, 'looks', p_cost);
    if p_source is not null then update agi1_inf_uploads set status = 'used', updated_at = now() where id = p_source; end if;
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free');
end;
$$;

-- An influencer as our server needs it (the page gets only some of it), with the looks or full body being made for it now
create or replace function public.inf_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(x) from (
    select i.id, i.wallet_code, i.name, i.mode, i.style, i.settings, i.words, i.source, i.status, i.first_job, i.looks_job, i.pick,
      i.body_job, i.body_tries, i.error, i.public, i.hidden, i.level, i.created_at, i.updated_at, i.ready_at,
      (select json_build_object('id', j.id, 'kind', j.kind, 'status', j.status, 'saving', j.saving, 'req', j.req is not null)
         from agi1_inf_jobs j where j.inf_id = i.id and j.kind in ('looks', 'body') and j.status in ('paid', 'making')
         order by j.created_at desc limit 1) as job
    from agi1_inf i where i.id = p_id
  ) x;
$$;

-- Its owner picks one of its 4 looks: its full body is made from it (part of what it cost: no credits).
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_yours" | "state" | "taken" | "bad"}
create or replace function public.inf_pick(p_id text, p_wallet text, p_look integer, p_job text)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
begin
  if p_look is null or p_look not between 0 and 3 or p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into i from agi1_inf where id = p_id for update;
  if not found or i.status = 'deleted' then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.status <> 'pick' or i.looks_job is null then return json_build_object('ok', false, 'why', 'state'); end if;
  begin
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, pick, cost) values (p_job, p_id, p_wallet, 'body', p_look, 0);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  update agi1_inf set status = 'body', pick = p_look, error = null, updated_at = now() where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- 4 new looks to pick from (p_cost credits): only while it's picking.
-- → {"ok": true, "paid", "free"} or {"ok": false, "why": "gone" | "not_yours" | "state" | "short" | "busy_day" | "taken" | "bad"}
create or replace function public.inf_reroll(p_id text, p_wallet text, p_job text, p_cost integer, p_day_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  s json;
begin
  if p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' or p_cost is null or p_cost not between 0 and 100000 or p_day_cap is null then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into i from agi1_inf where id = p_id for update;
  if not found or i.status = 'deleted' then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.status <> 'pick' then return json_build_object('ok', false, 'why', 'state'); end if;
  begin
    if not inf_day_take(p_day_cap) then return json_build_object('ok', false, 'why', 'busy_day'); end if;
    s := inf_spend(p_wallet, p_cost, p_job);
    if (s ->> 'ok')::boolean is not true then raise exception using errcode = 'P0001', message = coalesce(s ->> 'why', 'busy'); end if;
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, cost) values (p_job, p_id, p_wallet, 'looks', p_cost);
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  update agi1_inf set status = 'looks', error = null, updated_at = now() where id = p_id;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free');
end;
$$;

-- Something made for a ready influencer, by its own wallet: a photo in a scene, a trend video (a kept trend move, or its
-- owner's own clip that passed the AI check), or a scene video; from its full body, or (p_image) one of its done photos.
-- p_per_wallet: jobs one wallet may have being made at once · p_day_cap: AI jobs a day for the whole site.
-- → {"ok": true, "paid", "free"} or {"ok": false, "why": "gone" | "not_yours" | "not_ready" | "trend" | "clip" | "image" |
--   "too_many" | "short" | "busy_day" | "taken" | "bad"}
create or replace function public.inf_make(p_job text, p_inf text, p_wallet text, p_kind text, p_scene text, p_shape text, p_sound boolean,
  p_trend text, p_clip text, p_image text, p_cost integer, p_per_wallet integer, p_day_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  s json;
begin
  if p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' or p_kind is null or p_kind not in ('photo', 'trend', 'video')
     or p_cost is null or p_cost not between 0 and 100000 or p_per_wallet is null or p_per_wallet < 1 or p_day_cap is null
     or (p_kind in ('photo', 'video') and (p_scene is null or char_length(p_scene) not between 1 and 300 or p_shape is null
       or p_shape not in ('tall', 'wide', 'square') or p_trend is not null or p_clip is not null))
     or (p_kind = 'trend' and ((p_trend is null) = (p_clip is null) or p_scene is not null))
     or (p_kind = 'photo' and p_image is not null) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  select * into i from agi1_inf where id = p_inf for update;
  if not found or i.status = 'deleted' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.status <> 'ready' or i.body_job is null then return json_build_object('ok', false, 'why', 'not_ready'); end if;
  if p_trend is not null and not exists (select 1 from agi1_inf_trends t join agi1_inf_jobs j on j.id = t.job
      where t.id = p_trend and t.status = 'kept' and j.status = 'done') then
    return json_build_object('ok', false, 'why', 'trend');
  end if;
  if p_clip is not null and not exists (select 1 from agi1_inf_uploads where id = p_clip and wallet_code = p_wallet and kind = 'clip'
      and status = 'ok' and created_at > now() - interval '1 day') then
    return json_build_object('ok', false, 'why', 'clip');
  end if;
  if p_image is not null and not exists (select 1 from agi1_inf_jobs where id = p_image and inf_id = p_inf and kind = 'photo'
      and status = 'done' and not hidden) then
    return json_build_object('ok', false, 'why', 'image');
  end if;
  if (select count(*) from agi1_inf_jobs where wallet_code = p_wallet and status in ('paid', 'making')) >= p_per_wallet then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  begin
    if not inf_day_take(p_day_cap) then return json_build_object('ok', false, 'why', 'busy_day'); end if;
    if p_cost > 0 then
      s := inf_spend(p_wallet, p_cost, p_job);
      if (s ->> 'ok')::boolean is not true then raise exception using errcode = 'P0001', message = coalesce(s ->> 'why', 'busy'); end if;
    else
      s := inf_credits(p_wallet);
    end if;
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, scene, shape, sound, trend, clip, image, cost)
    values (p_job, p_inf, p_wallet, p_kind, p_scene, p_shape, coalesce(p_sound, false) and p_kind = 'video', p_trend, p_clip, p_image, p_cost);
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free');
end;
$$;

-- ---------- the AI jobs, moved along by our server ----------
-- A job as our server needs it, with its influencer's and its trend move's parts
create or replace function public.inf_job_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(x) from (
    select j.id, j.inf_id, j.wallet_code, j.kind, j.scene, j.shape, j.sound, j.trend, j.clip, j.image, j.pick, j.cost, j.status, j.req,
      j.status_url, j.result_url, j.saving, j.tries, j.error, j.refunded, j.files, j.bytes, j.poster, j.hidden, j.started_at,
      j.created_at, j.updated_at, j.done_at,
      i.name as inf_name, i.mode as inf_mode, i.style as inf_style, i.settings as inf_settings, i.words as inf_words,
      i.source as inf_source, i.status as inf_status, i.looks_job as inf_looks_job, i.pick as inf_pick, i.body_job as inf_body_job,
      i.hidden as inf_hidden, i.public as inf_public,
      (select t.job from agi1_inf_trends t where t.id = j.trend) as trend_job
    from agi1_inf_jobs j left join agi1_inf i on i.id = j.inf_id where j.id = p_id
  ) x;
$$;

-- Its turn, for p_secs seconds: true once (two server copies never move the same job at once)
create or replace function public.inf_job_lease(p_id text, p_secs integer)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set lease_until = now() + make_interval(secs => least(greatest(coalesce(p_secs, 45), 5), 300))
  where id = p_id and status in ('paid', 'making') and (lease_until is null or lease_until < now())
  returning true;
$$;

-- Where it is at the AI service: its request (its id and the addresses it gave), whether its files are being kept, its tries;
-- its turn is given back
create or replace function public.inf_job_step(p_id text, p_req text, p_status_url text, p_result_url text, p_saving boolean, p_tries integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if (p_req is not null and p_req !~ '^[A-Za-z0-9_-]{6,80}$') or p_saving is null or p_tries is null or p_tries not between 0 and 20 then
    return false;
  end if;
  update agi1_inf_jobs set status = 'making', req = p_req, status_url = p_status_url, result_url = p_result_url, saving = p_saving,
    tries = p_tries::smallint, started_at = case when status = 'paid' then now() else started_at end, lease_until = null, updated_at = now()
  where id = p_id and status in ('paid', 'making');
  return found;
end;
$$;

-- Its turn given back without a change (still being made), after a 3-second rest
create or replace function public.inf_job_wait(p_id text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set lease_until = now() + interval '3 seconds' where id = p_id and status in ('paid', 'making') returning true;
$$;

-- Done: its files are kept (p_files pictures, or a video of p_bytes). Its looks are shown to pick from; its full body makes
-- its influencer ready; a trend move waits for the owner's look.
create or replace function public.inf_job_done(p_id text, p_files integer, p_bytes integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  j agi1_inf_jobs%rowtype;
begin
  if p_files is null or p_files not between 0 and 4 or p_bytes is null or p_bytes not between 1 and 100000000 then return false; end if;
  select * into j from agi1_inf_jobs where id = p_id for update;
  if not found or j.status not in ('paid', 'making') then return false; end if;
  update agi1_inf_jobs set status = 'done', files = p_files, bytes = p_bytes, saving = false, status_url = null, result_url = null,
    lease_until = null, error = null, done_at = now(), updated_at = now()
  where id = p_id;
  if j.kind = 'looks' then
    update agi1_inf set status = 'pick', looks_job = p_id, error = null, updated_at = now() where id = j.inf_id and status = 'looks';
  elsif j.kind = 'body' then
    update agi1_inf set status = 'ready', body_job = p_id, error = null, ready_at = now(), updated_at = now() where id = j.inf_id and status = 'body';
  elsif j.kind = 'preset' then
    update agi1_inf_trends set status = 'review', updated_at = now() where id = j.trend and job = p_id;
  end if;
  return true;
end;
$$;

-- It couldn't be made: why (a few words for the page), and its credits given back (p_refund). Its influencer goes back to
-- its looks (a full body tried again, free, at most 3 times: then it can't be made, and its creation's credits come back), or
-- can't be made (its first looks).
create or replace function public.inf_job_fail(p_id text, p_error text, p_refund boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  j agi1_inf_jobs%rowtype;
  i agi1_inf%rowtype;
begin
  select * into j from agi1_inf_jobs where id = p_id for update;
  if not found or j.status not in ('paid', 'making') then return false; end if;
  update agi1_inf_jobs set status = 'failed', error = left(coalesce(p_error, 'failed'), 200), saving = false, lease_until = null,
    updated_at = now()
  where id = p_id;
  if coalesce(p_refund, true) and j.cost > 0 and not j.refunded then
    perform inf_refund(p_id);
    update agi1_inf_jobs set refunded = true where id = p_id;
  end if;
  if j.kind = 'preset' then
    update agi1_inf_trends set status = 'failed', updated_at = now() where id = j.trend and job = p_id;
    return true;
  end if;
  select * into i from agi1_inf where id = j.inf_id for update;
  if not found then return true; end if;
  if j.kind = 'looks' and i.status = 'looks' then
    update agi1_inf set status = case when i.looks_job is null then 'failed' else 'pick' end, error = left(p_error, 200), updated_at = now()
    where id = i.id;
  elsif j.kind = 'body' and i.status = 'body' then
    if i.body_tries + 1 >= 3 then
      update agi1_inf set status = 'failed', body_tries = i.body_tries + 1, error = left(p_error, 200), updated_at = now() where id = i.id;
      if i.first_job is not null and inf_refund(i.first_job) then
        update agi1_inf_jobs set refunded = true where id = i.first_job;
      end if;
    else
      update agi1_inf set status = 'pick', body_tries = i.body_tries + 1, error = left(p_error, 200), updated_at = now() where id = i.id;
    end if;
  end if;
  return true;
end;
$$;

-- The jobs our server should move along now (paid or being made, not someone else's turn), the longest-waiting first
create or replace function public.inf_job_due(p_limit integer)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(id order by updated_at), '{}'::text[]) from (
    select id, updated_at from agi1_inf_jobs
    where status in ('paid', 'making') and (lease_until is null or lease_until < now())
    order by updated_at limit least(greatest(coalesce(p_limit, 6), 1), 50)
  ) d;
$$;

-- A done job's poster (a frame its page took once, for Explore's tiles)
create or replace function public.inf_poster(p_job text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set poster = true, updated_at = now() where id = p_job and status = 'done' and kind in ('trend', 'video', 'preset')
  returning true;
$$;

-- ---------- what the pages show ----------
-- An influencer's photos and videos: the done ones (not hidden) for everyone; its own wallet's others too (being made, and
-- ones that couldn't be made in the last week), the newest first
create or replace function public.inf_jobs(p_inf text, p_wallet text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'kind', kind, 'scene', scene, 'shape', shape, 'sound', sound, 'trend', trend,
      'clip', clip is not null, 'image', image, 'status', status,
      'step', case when saving then 'save' when req is not null then 'make' else 'queue' end, 'error', error, 'refunded', refunded,
      'cost', cost, 'files', files, 'bytes', bytes, 'poster', poster, 'created_at', created_at, 'done_at', done_at,
      'mine', coalesce(wallet_code = p_wallet, false)) order by coalesce(done_at, created_at) desc), '[]'::json)
  from (
    select * from agi1_inf_jobs
    where inf_id = p_inf and kind in ('photo', 'trend', 'video')
      and ((status = 'done' and not hidden)
        or (p_wallet is not null and wallet_code = p_wallet and status <> 'done' and updated_at > now() - interval '7 days'))
    order by coalesce(done_at, created_at) desc
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ) d;
$$;

-- One wallet's influencers (not deleted), the newest first
create or replace function public.inf_mine(p_wallet text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'name', name, 'mode', mode, 'style', style, 'status', status, 'looks_job', looks_job,
      'pick', pick, 'body_job', body_job, 'public', public, 'hidden', hidden, 'created_at', created_at, 'ready_at', ready_at)
      order by created_at desc), '[]'::json)
  from (
    select * from agi1_inf where wallet_code = p_wallet and status <> 'deleted'
    order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) d;
$$;

-- Explore: the newest public influencers (never one made from a face), their newest videos, and the kept trend moves
create or replace function public.inf_explore(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'influencers', (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'style', style, 'looks_job', looks_job,
        'pick', pick, 'body_job', body_job, 'ready_at', ready_at) order by ready_at desc), '[]'::json)
      from (select * from agi1_inf where status = 'ready' and public and not hidden and mode <> 'face'
        order by ready_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) a),
    'fresh', (select coalesce(json_agg(json_build_object('id', j.id, 'kind', j.kind, 'shape', j.shape, 'trend', j.trend, 'poster', j.poster,
        'inf_id', j.inf_id, 'inf_name', j.inf_name, 'looks_job', j.inf_looks_job, 'pick', j.inf_pick, 'done_at', j.done_at) order by j.done_at desc), '[]'::json)
      from (select x.id, x.kind, x.shape, x.trend, x.poster, x.inf_id, x.done_at, i.name as inf_name, i.looks_job as inf_looks_job,
          i.pick as inf_pick
        from agi1_inf_jobs x join agi1_inf i on i.id = x.inf_id
        where x.status = 'done' and x.kind in ('trend', 'video') and not x.hidden and i.status = 'ready' and i.public and not i.hidden
          and i.mode <> 'face'
        order by x.done_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) j),
    'trends', (select coalesce(json_agg(json_build_object('id', t.id, 'job', t.job, 'poster', j.poster, 'bytes', j.bytes) order by t.sort, t.id), '[]'::json)
      from agi1_inf_trends t join agi1_inf_jobs j on j.id = t.job where t.status = 'kept' and j.status = 'done'));
$$;

-- Its owner shows it in Explore or not (never one made from a face). → {"ok": true} or {"ok": false, "why": "gone" |
-- "not_yours" | "face"}
create or replace function public.inf_public(p_id text, p_wallet text, p_public boolean)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
begin
  select * into i from agi1_inf where id = p_id for update;
  if not found or i.status = 'deleted' then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.mode = 'face' and coalesce(p_public, false) then return json_build_object('ok', false, 'why', 'face'); end if;
  update agi1_inf set public = coalesce(p_public, false), updated_at = now() where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- Its owner deletes it (for one made from their face: "Delete my face"): it's gone from every page at once, its jobs being
-- made stop (their credits come back), and our server deletes its files. → {"ok": true, "source"} or {"ok": false, "why":
-- "gone" | "not_yours"}
create or replace function public.inf_delete(p_id text, p_wallet text)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  j record;
begin
  select * into i from agi1_inf where id = p_id for update;
  if not found or i.status = 'deleted' then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  for j in select id, cost, refunded from agi1_inf_jobs where inf_id = p_id and status in ('paid', 'making') for update loop
    update agi1_inf_jobs set status = 'failed', error = 'deleted', lease_until = null, updated_at = now() where id = j.id;
    if j.cost > 0 and not j.refunded and inf_refund(j.id) then update agi1_inf_jobs set refunded = true where id = j.id; end if;
  end loop;
  update agi1_inf set status = 'deleted', hidden = true, public = false, updated_at = now() where id = p_id;
  update agi1_inf_uploads set status = 'refused', why = 'deleted', updated_at = now() where id = i.source;
  return json_build_object('ok', true, 'source', i.source);
end;
$$;

-- The owner's tools (in the SQL Editor, or the studio's owner page): hide an influencer or one of its photos and videos
-- from every page, or show it again.  select inf_hide('<its id>', true);  select inf_job_hide('<its id>', true);
create or replace function public.inf_hide(p_id text, p_hidden boolean)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf set hidden = coalesce(p_hidden, true), updated_at = now() where id = p_id and status <> 'deleted' returning true;
$$;
create or replace function public.inf_job_hide(p_id text, p_hidden boolean)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set hidden = coalesce(p_hidden, true), updated_at = now() where id = p_id returning true;
$$;

-- ---------- a 3D model of it (supabase/studio.sql's characters, made by Meshy from its full-body picture) ----------
-- Its owner orders one: p_cost credits, or a Soulmate's free one this month (p_free: studio.sql's agi1_studio_free); one at a
-- time per influencer; inside the studio's characters a month (p_cap, studio.sql's STUDIO_A_MONTH). p_burn: the wallet's code
-- in burns.sql (a studio order keeps it). → {"ok": true, "free", "paid", "free_credits"} or {"ok": false, "why": "gone" |
-- "not_yours" | "not_ready" | "busy3d" | "sold_out" | "short" | "taken" | "bad"}
create or replace function public.inf_3d(p_order text, p_inf text, p_wallet text, p_burn text, p_level integer, p_cost integer,
  p_cap integer, p_free boolean)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  m date := studio_this_month();
  is_free boolean := false;
  s json;
  v_made integer;
  v_live integer;
begin
  if p_order is null or p_order !~ '^[A-Za-z0-9_-]{22}$' or p_burn is null or char_length(p_burn) not between 16 and 64
     or p_level is null or p_level not between 1 and 3 or p_cost is null or p_cost not between 0 and 100000 or p_cap is null then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  select * into i from agi1_inf where id = p_inf for update;
  if not found or i.status = 'deleted' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.status <> 'ready' or i.body_job is null then return json_build_object('ok', false, 'why', 'not_ready'); end if;
  if exists (select 1 from agi1_studio_orders where inf_id = p_inf and status in ('paid', 'making')) then
    return json_build_object('ok', false, 'why', 'busy3d');
  end if;
  insert into agi1_studio_months (month) values (m) on conflict (month) do nothing;
  select coalesce(sm.made, 0) into v_made from agi1_studio_months sm where sm.month = m for update;
  select count(*) into v_live from agi1_studio_orders where status = 'quote' and created_at > now() - interval '1 day';
  if v_made + v_live >= p_cap then return json_build_object('ok', false, 'why', 'sold_out'); end if;
  begin
    if coalesce(p_free, false) and not exists (select 1 from agi1_studio_free where wallet_code = p_wallet and month = m) then
      insert into agi1_studio_free (wallet_code, month, order_id) values (p_wallet, m, p_order);
      is_free := true;
      s := inf_credits(p_wallet);
    elsif p_cost > 0 then
      s := inf_spend(p_wallet, p_cost, p_order);
      if (s ->> 'ok')::boolean is not true then raise exception using errcode = 'P0001', message = coalesce(s ->> 'why', 'busy'); end if;
    else
      s := inf_credits(p_wallet);
    end if;
    insert into agi1_studio_orders (id, wallet_code, burn_code, name, about, style, level, usd_cents, agi, free, kind, paid, status, paid_at,
      inf_id, image_path)
    values (p_order, p_wallet, p_burn, i.name, 'Made from ' || i.name || '''s full-body picture in AGI Studio.',
      case i.style when 'anime' then 'anime' when 'toon' then 'cartoon' else 'realistic' end, p_level, 0, 0, is_free,
      case when is_free then 'free' else 'credits' end, case when is_free then 0 else p_cost end, 'paid', now(),
      p_inf, 'inf/' || p_inf || '/' || i.body_job || '-0.jpg');
    update agi1_studio_months set made = made + 1 where month = m;
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'free', is_free, 'paid', s -> 'paid', 'free_credits', s -> 'free');
end;
$$;

-- A 3D model of an influencer that couldn't be made: its credits back (or a Soulmate's free one back for this month)
create or replace function public.inf_3d_back(p_order text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  back boolean;
begin
  back := inf_refund(p_order);
  delete from agi1_studio_free where order_id = p_order;
  return back or found;
end;
$$;

-- An influencer's 3D models (studio.sql's characters made from it), the newest first
create or replace function public.inf_3d_list(p_inf text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'status', status, 'step', step, 'error', error, 'moves', moves,
      'glb_bytes', glb_bytes, 'created_at', created_at, 'done_at', done_at) order by created_at desc), '[]'::json)
  from (select * from agi1_studio_orders where inf_id = p_inf and not hidden order by created_at desc limit 10) d;
$$;

-- ---------- the trend moves (the owner's, made once with AI) ----------
-- The owner has one made (again): its job, made by the AI service; it waits for the owner's look once made.
-- → {"ok": true} or {"ok": false, "why": "busy" | "bad"}
create or replace function public.trend_make(p_trend text, p_job text, p_sort integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_trend is null or p_trend !~ '^[a-z][a-z0-9-]{1,30}$' or p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-trend:' || p_trend));
  if exists (select 1 from agi1_inf_jobs where trend = p_trend and kind = 'preset' and status in ('paid', 'making')) then
    return json_build_object('ok', false, 'why', 'busy');
  end if;
  insert into agi1_inf_jobs (id, kind, trend, cost) values (p_job, 'preset', p_trend, 0);
  insert into agi1_inf_trends (id, status, job, sort) values (p_trend, 'making', p_job, coalesce(p_sort, 0))
  on conflict (id) do update set status = 'making', job = p_job, sort = coalesce(p_sort, agi1_inf_trends.sort), updated_at = now();
  return json_build_object('ok', true);
end;
$$;

-- The owner keeps a made trend move (it shows in Explore and can be picked) or hides it. → true, or false (nothing made yet)
create or replace function public.trend_set(p_trend text, p_status text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_trends t set status = p_status, updated_at = now()
  where t.id = p_trend and p_status in ('kept', 'hidden') and t.status in ('review', 'kept', 'hidden')
    and exists (select 1 from agi1_inf_jobs j where j.id = t.job and j.status = 'done')
  returning true;
$$;

-- Every trend move, for the owner's page: its state and its latest job's
create or replace function public.trend_list()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', t.id, 'status', t.status, 'job', t.job, 'job_status', j.status, 'error', j.error,
      'poster', coalesce(j.poster, false), 'bytes', j.bytes, 'updated_at', t.updated_at) order by t.sort, t.id), '[]'::json)
  from agi1_inf_trends t left join agi1_inf_jobs j on j.id = t.job;
$$;

-- ---------- reports ----------
-- Someone reports an influencer (or one of its videos or photos): why, and a daily code of who reported (p_who), at most
-- p_cap a day each. → {"ok": true} or {"ok": false, "why": "too_many" | "gone" | "bad"}
create or replace function public.inf_report(p_inf text, p_job text, p_why text, p_who text, p_cap integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_inf is null or p_inf !~ '^[A-Za-z0-9_-]{22}$' or (p_job is not null and p_job !~ '^[A-Za-z0-9_-]{22}$') or p_who is null
     or char_length(p_who) not between 16 and 64 or p_why is null
     or p_why not in ('real_person', 'minor', 'sexual', 'hate', 'violence', 'copyright', 'other') or p_cap is null then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  if not exists (select 1 from agi1_inf where id = p_inf and status <> 'deleted') then return json_build_object('ok', false, 'why', 'gone'); end if;
  if (select count(*) from agi1_inf_reports where who = p_who and day = (now() at time zone 'utc')::date) >= p_cap then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_reports (inf_id, job_id, why, who) values (p_inf, p_job, p_why, p_who) on conflict do nothing;
  return json_build_object('ok', true);
end;
$$;

-- The reports, for the owner's page: per influencer (and video or photo), how many, why, the latest, whether it's hidden
create or replace function public.inf_reports(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('inf_id', r.inf_id, 'job_id', r.job_id, 'count', r.n, 'whys', r.whys, 'at', r.at,
      'name', i.name, 'mode', i.mode, 'hidden', i.hidden or coalesce(j.hidden, false)) order by r.at desc), '[]'::json)
  from (
    select inf_id, job_id, count(*) as n, array_agg(distinct why) as whys, max(at) as at from agi1_inf_reports
    group by inf_id, job_id order by max(at) desc limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) r join agi1_inf i on i.id = r.inf_id left join agi1_inf_jobs j on j.id = r.job_id;
$$;

-- The owner dealt with them (hid it, or decided it's fine): its reports are cleared
create or replace function public.inf_report_clear(p_inf text, p_job text)
returns boolean
language sql
set search_path = public
as $$
  delete from agi1_inf_reports where inf_id = p_inf and coalesce(job_id, '') = coalesce(p_job, '') returning true;
$$;

-- ---------- tidy-up (the studio's clock, every half hour) ----------
-- Uploads go after 2 days (a selfie or a picture as soon as its influencer is made, or can't be: our server deletes their
-- files), influencers that couldn't be made after 30 days, deleted ones after a week (their files went at once), jobs that
-- failed after 60 days, reports after 90 days; leases left behind are given back. → {"uploads": [{id, kind}], "infs": [ids]
-- (their folders deleted again by our server, in case deleting them at once failed), …}
create or replace function public.inf_tidy()
returns json
language plpgsql
set search_path = public
as $$
declare
  ups json;
  infs json;
  jobs integer;
  reports integer;
begin
  with gone as (
    delete from agi1_inf_uploads u
    where (u.status in ('open', 'ok', 'refused') and u.created_at < now() - interval '2 days')
       or (u.status = 'refused' and u.why = 'deleted')
       or (u.status = 'used' and not exists (select 1 from agi1_inf i where i.source = u.id and i.status in ('looks', 'pick', 'body')))
    returning u.id, u.kind
  )
  select coalesce(json_agg(json_build_object('id', id, 'kind', kind)), '[]'::json) into ups from gone;
  with gone as (
    delete from agi1_inf where (status = 'failed' and updated_at < now() - interval '30 days')
      or (status = 'deleted' and updated_at < now() - interval '7 days')
    returning id, status
  )
  select coalesce(json_agg(id), '[]'::json) into infs from gone;
  delete from agi1_inf_jobs where status = 'failed' and updated_at < now() - interval '60 days';
  get diagnostics jobs = row_count;
  delete from agi1_inf_reports where at < now() - interval '90 days';
  get diagnostics reports = row_count;
  update agi1_inf_jobs set lease_until = null where lease_until < now() - interval '10 minutes';
  return json_build_object('uploads', ups, 'infs', infs, 'jobs', jobs, 'reports', reports);
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
do $do$
declare
  f text;
begin
  foreach f in array array[
    'inf_credits(text)', 'inf_spend(text, integer, text)', 'inf_refund(text)', 'inf_topup(text, text, integer)',
    'inf_free(text, integer, integer)', 'inf_upload_open(text, text, text, integer)', 'inf_upload_get(text)',
    'inf_upload_set(text, text, text, numeric)', 'inf_day_take(integer)',
    'inf_start(text, text, text, text, text, text, jsonb, text, text, integer, integer, integer, integer)', 'inf_get(text)',
    'inf_pick(text, text, integer, text)', 'inf_reroll(text, text, text, integer, integer)',
    'inf_make(text, text, text, text, text, text, boolean, text, text, text, integer, integer, integer)', 'inf_job_get(text)',
    'inf_job_lease(text, integer)', 'inf_job_step(text, text, text, text, boolean, integer)', 'inf_job_wait(text)',
    'inf_job_done(text, integer, integer)', 'inf_job_fail(text, text, boolean)', 'inf_job_due(integer)', 'inf_poster(text)',
    'inf_jobs(text, text, integer)', 'inf_mine(text, integer)', 'inf_explore(integer)', 'inf_public(text, text, boolean)',
    'inf_delete(text, text)', 'inf_hide(text, boolean)', 'inf_job_hide(text, boolean)',
    'inf_3d(text, text, text, text, integer, integer, integer, boolean)', 'inf_3d_back(text)', 'inf_3d_list(text)',
    'trend_make(text, text, integer)', 'trend_set(text, text)', 'trend_list()', 'inf_report(text, text, text, text, integer)',
    'inf_reports(integer)', 'inf_report_clear(text, text)', 'inf_tidy()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: influencers_ready = 1 (its 39 functions, and studio.sql's new parts it builds on)
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('inf_credits', 'inf_spend', 'inf_refund',
    'inf_topup', 'inf_free', 'inf_upload_open', 'inf_upload_get', 'inf_upload_set', 'inf_day_take', 'inf_start', 'inf_get', 'inf_pick',
    'inf_reroll', 'inf_make', 'inf_job_get', 'inf_job_lease', 'inf_job_step', 'inf_job_wait', 'inf_job_done', 'inf_job_fail',
    'inf_job_due', 'inf_poster', 'inf_jobs', 'inf_mine', 'inf_explore', 'inf_public', 'inf_delete', 'inf_hide', 'inf_job_hide',
    'inf_3d', 'inf_3d_back', 'inf_3d_list', 'trend_make', 'trend_set', 'trend_list', 'inf_report', 'inf_reports',
    'inf_report_clear', 'inf_tidy')) / 39
    * (case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_studio_orders'
        and column_name = 'image_path') then 1 else 0 end)
    as influencers_ready;
