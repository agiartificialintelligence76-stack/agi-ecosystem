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
--   agi1_credit_log     each top-up, spend, refund and free grant, and (round 3) each gift from the owner (its wallet code,
--                       the amount, what it was for)
--   agi1_credit_months  per month: the free credits given out (the whole site's cap)
--   agi1_inf_uploads    each picture, selfie or clip uploaded: its wallet code, its kind, whether the AI check passed it, a
--                       clip's length (the files are deleted within 2 days, a selfie or picture as soon as its influencer is
--                       made)
--   agi1_inf_trends     the trend moves (the owner's): their state and their video's job
--   agi1_inf_reports    reports of an influencer or one of its videos: why, and a daily code of who reported (never an IP)
--   agi1_inf_days       per day: the AI jobs started (the whole site's cap)
-- Never an address, a transaction, an IP address or anything else about anyone (but a weekly spotlight's prize: below).
--
-- Round 2 (2026-10-10, the owner: "remove the use your face", "no restrictions on That looks like a photo of a real
-- person" ("Allowed with consent"), "the trending videos should be real like in higgsfield", "in the make it yours show
-- example of the image", "large burns can make free 3d model" (25,000 $AGI), and the flywheel: a share mark, a weekly
-- spotlight, burn unlocks and a live stats board). Run this file again (it keeps everything saved). It adds:
--   • a photo of a real person, with its uploader's consent: whether an upload (and the influencer made from it) is a real
--     person's photo (`real`). One is never in Explore (like one made from a face before: no new ones of those).
--   • example pictures for the design choices (jobs of the kind 'example', with no influencer: the owner's, made once)
--   • the share mark on downloaded videos (`marked`: a copy with the mark, made by the clock)
--   • likes (agi1_inf_likes: per creation, a scrambled code of the wallet that liked it and its level) and the weekly
--     spotlight (agi1_inf_weeks: each week's most liked creation, approved by the owner; its prize, sent to its maker's
--     wallet once they claim it, keeps the address it went to and its transaction, 60 days)
--   • burn unlocks (agi1_inf_burns: a boost in Explore or one more influencer, paid by burning $AGI from the wallet's own
--     app, each burn counted once in burns.sql's ledger; agi1_inf_slots: the extra influencers a wallet unlocked) and a free
--     3D model for a burn (an order in studio.sql, paid like its characters' burns)
--   • the live stats board's numbers (inf_stats: totals only)
-- Round 3 (2026-10-10, the owner: "i cant even test it myself i dont have enough credits lol", then "Owner credits button
-- (Recommended)"). Run this file again (it keeps everything saved). It adds:
--   • credits the owner gives from the owner's page, free, to the owner's own wallet or a tester's (inf_gift: like bought
--     ones, they never run out; each gift in agi1_credit_log as kind 'gift'). Nothing is paid to anyone: what they're spent on
--     is paid from the owner's own AI balance (fal.ai), like everything made here.

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
  kind        text        not null check (kind in ('topup', 'spend', 'refund', 'free', 'gift')),
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

-- ---------- round 2 (2026-10-10): columns and rules added to tables that may be there already ----------
-- a photo of a real person (uploaded with its uploader's consent): the upload, and the influencer made from it
alter table public.agi1_inf_uploads add column if not exists real boolean not null default false;
alter table public.agi1_inf add column if not exists real boolean not null default false;
-- a boost in Explore, unlocked by a burn: until when
alter table public.agi1_inf add column if not exists boost_until timestamptz;
-- example pictures for the design choices: jobs with no influencer, each for one choice (e.g. "outfit-cozy")
alter table public.agi1_inf_jobs add column if not exists example text check (example ~ '^[a-z]{3,6}-[a-z0-9]{2,12}$');
-- the share mark on a done video's download: made (a copy with the mark), how many tries, the last try
alter table public.agi1_inf_jobs add column if not exists marked boolean not null default false;
alter table public.agi1_inf_jobs add column if not exists mark_tries smallint not null default 0 check (mark_tries between 0 and 20);
alter table public.agi1_inf_jobs add column if not exists mark_at timestamptz;
-- its likes (agi1_inf_likes holds who: this is their count, for the pages)
alter table public.agi1_inf_jobs add column if not exists likes integer not null default 0 check (likes >= 0);
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_kind_check;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_kind_check
  check (kind in ('looks', 'body', 'photo', 'trend', 'video', 'preset', 'example'));
-- the owner's jobs (trend clips, example pictures) have no influencer; everyone else's have one
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_check;
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_owner_check;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_owner_check check ((kind in ('preset', 'example')) = (inf_id is null));
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_example_check2;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_example_check2 check ((kind = 'example') = (example is not null));
create index if not exists agi1_inf_jobs_examples on public.agi1_inf_jobs (example, created_at) where kind = 'example';
create index if not exists agi1_inf_jobs_mark on public.agi1_inf_jobs (done_at) where status = 'done' and not marked and kind in ('trend', 'video');
create index if not exists agi1_inf_jobs_made on public.agi1_inf_jobs (done_at) where status = 'done' and kind in ('photo', 'trend', 'video');
create index if not exists agi1_inf_boosted on public.agi1_inf (boost_until) where boost_until is not null;

-- likes: one per wallet per creation (a scrambled code of the wallet, never its address), with its level when it liked it
-- (the weekly spotlight counts holders' likes: one person can't make many Crush or Soulmate wallets)
create table if not exists public.agi1_inf_likes (
  job_id      text        not null references public.agi1_inf_jobs (id) on delete cascade,
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  level       smallint    not null check (level between 1 and 3),
  at          timestamptz not null default now(),
  primary key (job_id, wallet_code)
);
create index if not exists agi1_inf_likes_wallet on public.agi1_inf_likes (wallet_code, at);

-- the weekly spotlight: a week (its Monday, UTC), its most liked creation (picked by the clock, approved or skipped by the
-- owner), and its prize: claimed by the wallet that made it, sent once from the prize wallet (the address it went to and its
-- transaction are kept 60 days after it's sent, then the address goes)
create table if not exists public.agi1_inf_weeks (
  week         date        primary key check (extract(isodow from week) = 1),
  status       text        not null default 'none' check (status in ('none', 'picked', 'approved', 'claimed', 'sending', 'sent')),
  job_id       text        check (job_id ~ '^[A-Za-z0-9_-]{22}$'),
  inf_id       text        check (inf_id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code  text        check (char_length(wallet_code) between 16 and 64),
  holder_likes integer     not null default 0 check (holder_likes >= 0),
  likes        integer     not null default 0 check (likes >= 0),
  skipped      text[]      not null default '{}'::text[],
  prize        bigint      not null default 0 check (prize between 0 and 1000000000),     -- whole $AGI
  address      text        check (address ~ '^0x[0-9a-f]{40}$'),
  tx           text        check (tx ~ '^0x[0-9a-f]{64}$'),
  picked_at    timestamptz not null default now(),
  approved_at  timestamptz,
  claimed_at   timestamptz,
  sent_at      timestamptz
);

-- burn unlocks: a boost in Explore for one of its influencers ('boost', for so many hours) or one more influencer ('slot'),
-- paid by burning $AGI from the wallet's own app (each burn counted once, in burns.sql's ledger too, and toward its level)
create table if not exists public.agi1_inf_burns (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  burn_code   text        not null check (char_length(burn_code) between 16 and 64),     -- the wallet's code in burns.sql
  what        text        not null check (what in ('boost', 'slot')),
  inf_id      text        check (inf_id ~ '^[A-Za-z0-9_-]{22}$'),
  agi         bigint      not null check (agi between 1 and 1000000000),                -- its price, whole $AGI
  hours       smallint    not null default 0 check (hours between 0 and 720),           -- a boost's
  paid        numeric     not null default 0 check (paid >= 0),                         -- burned toward it so far
  status      text        not null default 'quote' check (status in ('quote', 'paid')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  check ((what = 'boost') = (inf_id is not null))
);
create index if not exists agi1_inf_burns_wallet on public.agi1_inf_burns (wallet_code, created_at);
create table if not exists public.agi1_inf_slots (
  wallet_code text    primary key check (char_length(wallet_code) between 16 and 64),
  extra       integer not null default 0 check (extra between 0 and 1000)
);

-- ---------- round 3 (2026-10-10): the owner's gifts of credits ----------
-- a gift is a kind of its own in the credits' log (an older check, without it, goes first)
alter table public.agi1_credit_log drop constraint if exists agi1_credit_log_kind_check;
alter table public.agi1_credit_log add constraint agi1_credit_log_kind_check check (kind in ('topup', 'spend', 'refund', 'free', 'gift'));

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_inf_likes enable row level security;
alter table public.agi1_inf_weeks enable row level security;
alter table public.agi1_inf_burns enable row level security;
alter table public.agi1_inf_slots enable row level security;
revoke all on table public.agi1_inf_likes, public.agi1_inf_weeks, public.agi1_inf_burns, public.agi1_inf_slots from anon, authenticated;
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

-- (round 3) Credits the owner gives (the owner's page: "Credits for testing"), free, to the owner's own wallet or a tester's
-- (p_wallet: its scrambled code; p_ref: this gift's own id, so a gift counts once). Like bought ones: they never run out, and
-- what's spent from them is given back the same way when something can't be made. Nothing is paid to anyone; what they're
-- spent on is paid from the owner's own AI balance. Only our server calls it, and only for the owner's wallet.
-- → {"ok": true, "paid"} or {"ok": false, "why": "taken" | "bad"}
create or replace function public.inf_gift(p_wallet text, p_credits integer, p_ref text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_credits is null or p_credits not between 1 and 100000
     or p_ref is null or p_ref !~ '^[A-Za-z0-9_-]{22}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  begin
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, ref)
    values (p_wallet, 'gift', p_credits, p_credits, 0, p_ref);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  update agi1_credits set paid = least(paid + p_credits, 100000000), updated_at = now() where wallet_code = p_wallet returning paid into v;
  return json_build_object('ok', true, 'paid', v);
end;
$$;

-- ---------- uploads (a picture or a photo, a clip; a selfie before round 2) ----------
-- A new upload, before its file comes (p_per_day: uploads one wallet may start a day). Since round 2 never a selfie ('face':
-- "Use my face" is gone; a photo of a real person is a 'picture', uploaded with its uploader's consent).
-- → {"ok": true} or {"ok": false, "why": "too_many" | "bad" | "taken"}
create or replace function public.inf_upload_open(p_id text, p_wallet text, p_kind text, p_per_day integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_kind is null or p_kind not in ('picture', 'clip') or p_per_day is null or p_per_day < 1 then
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
  select row_to_json(u) from (select id, wallet_code, kind, status, why, seconds, real, created_at from agi1_inf_uploads where id = p_id) u;
$$;

-- Its file is in and checked: 'ok' (it may be used) or 'refused' (why: the AI check's reason); a clip's length; whether it's
-- a photo of a real person (round 2: then its influencer is never in Explore). (Round 2 added p_real: the older version is
-- dropped first, so the web API never has two to choose from.)
drop function if exists public.inf_upload_set(text, text, text, numeric);
create or replace function public.inf_upload_set(p_id text, p_status text, p_why text, p_seconds numeric, p_real boolean default false)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_status is null or p_status not in ('ok', 'refused') or (p_seconds is not null and (p_seconds <= 0 or p_seconds > 60)) then
    return false;
  end if;
  update agi1_inf_uploads set status = p_status, why = left(p_why, 40), seconds = coalesce(p_seconds, seconds),
    real = coalesce(p_real, false), updated_at = now()
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
-- p_mode 'picture' needs its upload (p_source: this wallet's, a picture, passed by the AI check: a photo of a real person
-- makes one that's never in Explore). Since round 2 never 'face' (old ones stay as they are). p_per_wallet: influencers one
-- wallet may have being made at once · p_day_cap: AI jobs a day for the whole site · p_slots (round 2): influencers one
-- wallet may have at all (not deleted, nor failed), plus the ones it unlocked by burning (agi1_inf_slots); null: no limit.
-- (Round 2 added p_slots: the older version is dropped first, so the web API never has two to choose from.)
-- → {"ok": true, "paid", "free"} or {"ok": false, "why": "short" | "source" | "too_many" | "no_slot" | "busy_day" | "taken" | "bad"}
drop function if exists public.inf_start(text, text, text, text, text, text, jsonb, text, text, integer, integer, integer, integer);
create or replace function public.inf_start(p_id text, p_job text, p_wallet text, p_name text, p_mode text, p_style text,
  p_settings jsonb, p_words text, p_source text, p_level integer, p_cost integer, p_per_wallet integer, p_day_cap integer,
  p_slots integer default null)
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
     or p_mode is null or p_mode not in ('design', 'picture') or p_style is null or p_style not in ('real', 'anime', 'toon')
     or p_settings is null or jsonb_typeof(p_settings) <> 'object' or char_length(coalesce(p_words, '')) > 200
     or p_level is null or p_level not between 1 and 3 or p_cost is null or p_cost not between 0 and 100000
     or p_per_wallet is null or p_per_wallet < 1 or p_day_cap is null or p_day_cap < 1 or (p_slots is not null and p_slots < 1)
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
  if p_slots is not null and (select count(*) from agi1_inf where wallet_code = p_wallet and status in ('looks', 'pick', 'body', 'ready'))
       >= p_slots + coalesce((select extra from agi1_inf_slots where wallet_code = p_wallet), 0) then
    return json_build_object('ok', false, 'why', 'no_slot');
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
    insert into agi1_inf (id, wallet_code, name, mode, style, settings, words, source, status, first_job, public, real, level)
    values (p_id, p_wallet, p_name, p_mode, p_style, p_settings, coalesce(p_words, ''), p_source, 'looks', p_job,
      not coalesce(u.real, false), coalesce(u.real, false), p_level);
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
      i.body_job, i.body_tries, i.error, i.public, i.hidden, i.level, i.created_at, i.updated_at, i.ready_at, i.real, i.boost_until,
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
      j.created_at, j.updated_at, j.done_at, j.example, j.marked, j.mark_tries, j.likes,
      i.name as inf_name, i.mode as inf_mode, i.style as inf_style, i.settings as inf_settings, i.words as inf_words,
      i.source as inf_source, i.status as inf_status, i.looks_job as inf_looks_job, i.pick as inf_pick, i.body_job as inf_body_job,
      i.hidden as inf_hidden, i.public as inf_public, i.real as inf_real,
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
-- its influencer ready; a trend clip waits for the owner's look (an example picture is shown at once: the owner sees it on
-- the owner's page and can make it again).
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
  if j.kind = 'example' then return true; end if;
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
      'likes', likes, 'marked', marked,
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
      'pick', pick, 'body_job', body_job, 'public', public, 'hidden', hidden, 'created_at', created_at, 'ready_at', ready_at,
      'real', real, 'boost_until', boost_until)
      order by created_at desc), '[]'::json)
  from (
    select * from agi1_inf where wallet_code = p_wallet and status <> 'deleted'
    order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) d;
$$;

-- Explore: the newest public influencers (never one made from a face or from a photo of a real person), their newest photos
-- and videos (with their likes), the kept trend clips, the boosted influencers (a burn unlocked it: round 2) and the
-- spotlight of the week (the newest one the owner approved, in the last two weeks)
create or replace function public.inf_explore(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'influencers', (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'style', style, 'looks_job', looks_job,
        'pick', pick, 'body_job', body_job, 'ready_at', ready_at) order by ready_at desc), '[]'::json)
      from (select * from agi1_inf where status = 'ready' and public and not hidden and mode <> 'face' and not real
        order by ready_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) a),
    'fresh', (select coalesce(json_agg(json_build_object('id', j.id, 'kind', j.kind, 'shape', j.shape, 'trend', j.trend, 'poster', j.poster,
        'files', j.files, 'likes', j.likes, 'inf_id', j.inf_id, 'inf_name', j.inf_name, 'looks_job', j.inf_looks_job, 'pick', j.inf_pick,
        'done_at', j.done_at) order by j.done_at desc), '[]'::json)
      from (select x.id, x.kind, x.shape, x.trend, x.poster, x.files, x.likes, x.inf_id, x.done_at, i.name as inf_name,
          i.looks_job as inf_looks_job, i.pick as inf_pick
        from agi1_inf_jobs x join agi1_inf i on i.id = x.inf_id
        where x.status = 'done' and x.kind in ('photo', 'trend', 'video') and not x.hidden and i.status = 'ready' and i.public and not i.hidden
          and i.mode <> 'face' and not i.real
        order by x.done_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) j),
    'trends', (select coalesce(json_agg(json_build_object('id', t.id, 'job', t.job, 'poster', j.poster, 'bytes', j.bytes) order by t.sort, t.id), '[]'::json)
      from agi1_inf_trends t join agi1_inf_jobs j on j.id = t.job where t.status = 'kept' and j.status = 'done'),
    'boosted', (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'style', style, 'looks_job', looks_job, 'pick', pick,
        'body_job', body_job, 'until', boost_until) order by boost_until desc), '[]'::json)
      from (select * from agi1_inf where boost_until > now() and status = 'ready' and public and not hidden and mode <> 'face' and not real
        order by boost_until desc limit 12) b),
    'spotlight', (select row_to_json(s) from (
        select w.week, w.status, w.holder_likes, w.likes, w.prize, j.id, j.kind, j.shape, j.poster, j.files, j.inf_id,
          i.name as inf_name, i.looks_job, i.pick
        from agi1_inf_weeks w join agi1_inf_jobs j on j.id = w.job_id join agi1_inf i on i.id = j.inf_id
        where w.status in ('approved', 'claimed', 'sending', 'sent') and w.week >= (date_trunc('week', now() at time zone 'utc')::date - 14)
          and j.status = 'done' and not j.hidden and i.status = 'ready' and not i.hidden
        order by w.week desc limit 1) s));
$$;

-- Its owner shows it in Explore or not (never one made from a face or a photo of a real person). → {"ok": true} or {"ok":
-- false, "why": "gone" | "not_yours" | "private"}
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
  if (i.mode = 'face' or i.real) and coalesce(p_public, false) then return json_build_object('ok', false, 'why', 'private'); end if;
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

-- An influencer's 3D models (studio.sql's characters made from it), the newest first: how each is paid (round 2: 'burn',
-- with its price in $AGI and what's burned so far, until it's paid), and whether one that couldn't be made may be made again
-- free (a burned one: `credit`), or a quote that went nowhere (`expired`)
create or replace function public.inf_3d_list(p_inf text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'status', status, 'step', step, 'error', error, 'moves', moves,
      'glb_bytes', glb_bytes, 'created_at', created_at, 'done_at', done_at, 'kind', kind, 'agi', agi, 'paid', paid,
      'credit', credit and updated_at > now() - interval '30 days',
      'expired', status = 'quote' and paid = 0 and created_at < now() - interval '1 day') order by created_at desc), '[]'::json)
  from (select * from agi1_studio_orders where inf_id = p_inf and not hidden order by created_at desc limit 10) d;
$$;

-- A free 3D model for a burn (round 2; the owner: "large burns can make free 3d model", 25,000 $AGI): its order waits for the
-- burn, sent from the wallet's own app to the burn address and read on the chain by our server (studio.sql's studio_pay:
-- counted once, in burns.sql's ledger too, and toward the wallet's level); paid, it's made like one from credits. One open at
-- a time per influencer (asked again: the same one). Inside the studio's characters a month (p_cap) and its burns
-- (p_burn_cap, studio.sql's STUDIO_BURNS_A_MONTH). p_agi: its price in whole $AGI.
-- → {"ok": true, "order", "agi", "paid", "created", "again"} or {"ok": false, "why": "gone" | "not_yours" | "not_ready" |
--   "busy3d" | "sold_out" | "burns_sold_out" | "bad"}
create or replace function public.inf_3d_burn(p_order text, p_inf text, p_wallet text, p_burn text, p_level integer, p_agi bigint,
  p_cap integer, p_burn_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  o agi1_studio_orders%rowtype;
  m agi1_studio_months%rowtype;
  live integer;
  burn_live integer;
begin
  if p_order is null or p_order !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_burn is null or char_length(p_burn) not between 16 and 64 or p_level is null or p_level not between 1 and 3
     or p_agi is null or p_agi not between 1 and 1000000000 or p_cap is null or p_cap < 0 or p_burn_cap is null or p_burn_cap < 0 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  -- the month's row first (like every function that counts the studio's places)
  insert into agi1_studio_months (month) values (studio_this_month()) on conflict (month) do nothing;
  select * into m from agi1_studio_months where month = studio_this_month() for update;
  select * into i from agi1_inf where id = p_inf for update;
  if not found or i.status = 'deleted' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if i.status <> 'ready' or i.body_job is null then return json_build_object('ok', false, 'why', 'not_ready'); end if;
  if exists (select 1 from agi1_studio_orders where inf_id = p_inf and status in ('paid', 'making')) then
    return json_build_object('ok', false, 'why', 'busy3d');
  end if;
  select * into o from agi1_studio_orders where inf_id = p_inf and wallet_code = p_wallet and status = 'quote' and kind = 'burn'
    and (paid > 0 or created_at > now() - interval '1 day') order by created_at desc limit 1;
  if found then
    return json_build_object('ok', true, 'order', o.id, 'agi', o.agi, 'paid', o.paid, 'created', o.created_at, 'again', true);
  end if;
  select count(*), count(*) filter (where kind = 'burn') into live, burn_live from agi1_studio_orders
    where status = 'quote' and created_at > now() - interval '1 day';
  if m.made + live >= p_cap then return json_build_object('ok', false, 'why', 'sold_out'); end if;
  if m.burns + burn_live >= p_burn_cap then return json_build_object('ok', false, 'why', 'burns_sold_out'); end if;
  insert into agi1_studio_orders (id, wallet_code, burn_code, name, about, style, level, usd_cents, agi, free, kind, status, inf_id, image_path)
  values (p_order, p_wallet, p_burn, i.name, 'Made from ' || i.name || '''s full-body picture in AGI Studio.',
    case i.style when 'anime' then 'anime' when 'toon' then 'cartoon' else 'realistic' end, p_level, 0, p_agi, false, 'burn', 'quote',
    p_inf, 'inf/' || p_inf || '/' || i.body_job || '-0.jpg')
  on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  return json_build_object('ok', true, 'order', p_order, 'agi', p_agi, 'paid', 0, 'created', now(), 'again', false);
end;
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
      'name', i.name, 'mode', i.mode, 'real', i.real, 'hidden', i.hidden or coalesce(j.hidden, false)) order by r.at desc), '[]'::json)
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

-- ---------- example pictures for the design choices (round 2: the owner's, made once each on the owner's page) ----------
-- One made (again) for a choice (p_key, e.g. "outfit-cozy"): a job with no influencer, made by the AI service from the owner's
-- balance (no credits). → {"ok": true} or {"ok": false, "why": "busy" (one is being made) | "taken" | "bad"}
create or replace function public.inf_example_make(p_key text, p_job text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_key is null or p_key !~ '^[a-z]{3,6}-[a-z0-9]{2,12}$' or p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-example:' || p_key));
  if exists (select 1 from agi1_inf_jobs where kind = 'example' and example = p_key and status in ('paid', 'making')) then
    return json_build_object('ok', false, 'why', 'busy');
  end if;
  insert into agi1_inf_jobs (id, kind, example, shape, cost) values (p_job, 'example', p_key, 'square', 0) on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  return json_build_object('ok', true);
end;
$$;

-- Every choice's example: its newest done picture (`done`, what the pages show) and its newest job (for the owner: being
-- made, or why it couldn't be)
create or replace function public.inf_examples()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('key', k.example, 'done', d.id, 'latest', l.id, 'status', l.status, 'error', l.error,
      'at', coalesce(d.done_at, l.created_at)) order by k.example), '[]'::json)
  from (select distinct example from agi1_inf_jobs where kind = 'example' and example is not null) k
  left join lateral (select id, done_at from agi1_inf_jobs where kind = 'example' and example = k.example and status = 'done' and not hidden
    order by done_at desc limit 1) d on true
  left join lateral (select id, status, error, created_at from agi1_inf_jobs where kind = 'example' and example = k.example
    order by created_at desc limit 1) l on true;
$$;

-- ---------- the share mark on downloaded videos (round 2: server/inf-mark.js, on the studio's clock) ----------
-- One done video to mark, the newest first (in its first 30 days): taken for 3 minutes, at most 3 tries (then its download
-- stays unmarked). → {id, inf_id, kind, bytes, tries} or null (nothing to do)
create or replace function public.inf_mark_take()
returns json
language plpgsql
set search_path = public
as $$
declare
  r agi1_inf_jobs%rowtype;
begin
  select * into r from agi1_inf_jobs
  where kind in ('trend', 'video') and status = 'done' and not hidden and not marked and mark_tries < 3
    and (mark_at is null or mark_at < now() - interval '3 minutes') and done_at > now() - interval '30 days'
  order by done_at desc limit 1 for update skip locked;
  if not found then return null; end if;
  update agi1_inf_jobs set mark_tries = mark_tries + 1, mark_at = now() where id = r.id;
  return json_build_object('id', r.id, 'inf_id', r.inf_id, 'kind', r.kind, 'bytes', r.bytes, 'tries', r.mark_tries + 1);
end;
$$;

-- Its marked copy is kept: downloads use it from now on
create or replace function public.inf_mark_done(p_job text)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set marked = true, mark_at = now() where id = p_job and status = 'done' returning true;
$$;

-- ---------- likes and the weekly spotlight (round 2: the owner's flywheel) ----------
-- A like (p_like) or taking it back, by a signed-in wallet (p_level: its level now; at most p_per_day likes a day): only a
-- done photo or video of a public influencer (never one made from a face or a photo of a real person), never its own.
-- → {"ok": true, "liked", "likes"} or {"ok": false, "why": "gone" | "private" | "own" | "too_many" | "bad"}
create or replace function public.inf_like(p_job text, p_wallet text, p_level integer, p_like boolean, p_per_day integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  j agi1_inf_jobs%rowtype;
  i agi1_inf%rowtype;
  n integer;
begin
  if p_job is null or p_job !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_level is null or p_level not between 1 and 3 or p_like is null or p_per_day is null or p_per_day < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into j from agi1_inf_jobs where id = p_job for update;
  if not found or j.status <> 'done' or j.hidden or j.kind not in ('photo', 'trend', 'video') then
    return json_build_object('ok', false, 'why', 'gone');
  end if;
  select * into i from agi1_inf where id = j.inf_id;
  if not found or i.status <> 'ready' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
  if not i.public or i.mode = 'face' or i.real then return json_build_object('ok', false, 'why', 'private'); end if;
  if j.wallet_code = p_wallet then return json_build_object('ok', false, 'why', 'own'); end if;
  if p_like then
    perform pg_advisory_xact_lock(hashtext('agi1-inf-likes:' || p_wallet));
    if exists (select 1 from agi1_inf_likes where job_id = p_job and wallet_code = p_wallet) then
      return json_build_object('ok', true, 'liked', true, 'likes', j.likes);
    end if;
    select count(*) into n from agi1_inf_likes where wallet_code = p_wallet and at > now() - interval '1 day';
    if n >= p_per_day then return json_build_object('ok', false, 'why', 'too_many'); end if;
    insert into agi1_inf_likes (job_id, wallet_code, level) values (p_job, p_wallet, p_level) on conflict do nothing;
    if found then
      update agi1_inf_jobs set likes = likes + 1 where id = p_job returning likes into n;
      return json_build_object('ok', true, 'liked', true, 'likes', n);
    end if;
    return json_build_object('ok', true, 'liked', true, 'likes', j.likes);
  end if;
  delete from agi1_inf_likes where job_id = p_job and wallet_code = p_wallet;
  if found then
    update agi1_inf_jobs set likes = greatest(likes - 1, 0) where id = p_job returning likes into n;
    return json_build_object('ok', true, 'liked', false, 'likes', n);
  end if;
  return json_build_object('ok', true, 'liked', false, 'likes', j.likes);
end;
$$;

-- Which of these photos and videos this wallet liked (its hearts, filled in on the pages)
create or replace function public.inf_liked(p_wallet text, p_jobs text[])
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(job_id order by job_id), '{}'::text[]) from agi1_inf_likes
  where wallet_code = p_wallet and p_jobs is not null and cardinality(p_jobs) <= 200 and job_id = any(p_jobs);
$$;

-- A week's best creation: done that week (p_week: its Monday, UTC), of a public influencer (never one made from a face or a
-- photo of a real person), not hidden, not skipped by the owner (p_skip), liked by at least one holder; the most holders'
-- likes first (Crush and Soulmate wallets), then all likes, then the first made
create or replace function public.inf_week_top(p_week date, p_skip text[])
returns table (job_id text, inf_id text, wallet_code text, holder_likes integer, likes integer)
language sql
stable
set search_path = public
as $$
  select c.id, c.inf_id, c.wallet_code, c.holder_likes, c.likes from (
    select j.id, j.inf_id, j.wallet_code, j.likes, j.done_at,
      (select count(*) from agi1_inf_likes l where l.job_id = j.id and l.level >= 2)::integer as holder_likes
    from agi1_inf_jobs j join agi1_inf i on i.id = j.inf_id
    where j.kind in ('photo', 'trend', 'video') and j.status = 'done' and not j.hidden
      and j.done_at >= (p_week::timestamp at time zone 'utc') and j.done_at < ((p_week + 7)::timestamp at time zone 'utc')
      and i.status = 'ready' and i.public and not i.hidden and i.mode <> 'face' and not i.real
      and not (j.id = any(coalesce(p_skip, '{}'::text[])))
  ) c
  where c.holder_likes >= 1
  order by c.holder_likes desc, c.likes desc, c.done_at asc
  limit 1;
$$;

-- The clock picks a week's spotlight once, when the week is over (p_week: a past Monday): its best creation, waiting for the
-- owner's look ('picked'), or 'none'. Asked again, the same week as it is. → {"ok": true, "status", "job"} or {"ok": false,
-- "why": "bad"}
create or replace function public.inf_week_pick(p_week date)
returns json
language plpgsql
set search_path = public
as $$
declare
  w agi1_inf_weeks%rowtype;
  t record;
begin
  if p_week is null or extract(isodow from p_week) <> 1 or p_week >= date_trunc('week', now() at time zone 'utc')::date then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-week:' || p_week::text));
  select * into w from agi1_inf_weeks where week = p_week;
  if found then return json_build_object('ok', true, 'status', w.status, 'job', w.job_id, 'again', true); end if;
  select * into t from inf_week_top(p_week, '{}'::text[]);
  if not found then
    insert into agi1_inf_weeks (week, status) values (p_week, 'none');
    return json_build_object('ok', true, 'status', 'none', 'job', null, 'again', false);
  end if;
  insert into agi1_inf_weeks (week, status, job_id, inf_id, wallet_code, holder_likes, likes)
  values (p_week, 'picked', t.job_id, t.inf_id, t.wallet_code, t.holder_likes, t.likes);
  return json_build_object('ok', true, 'status', 'picked', 'job', t.job_id, 'again', false);
end;
$$;

-- The owner approves a picked week (with its prize in whole $AGI, 0 = for glory only: it's shown in Explore), or skips it to
-- the next best creation. → {"ok": true, "status", "job"} or {"ok": false, "why": "gone" | "state" | "bad"}
create or replace function public.inf_week_set(p_week date, p_action text, p_prize bigint)
returns json
language plpgsql
set search_path = public
as $$
declare
  w agi1_inf_weeks%rowtype;
  t record;
begin
  if p_week is null or p_action is null or p_action not in ('approve', 'skip')
     or (p_action = 'approve' and (p_prize is null or p_prize not between 0 and 1000000000)) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into w from agi1_inf_weeks where week = p_week for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if w.status <> 'picked' then return json_build_object('ok', false, 'why', 'state'); end if;
  if p_action = 'approve' then
    update agi1_inf_weeks set status = 'approved', prize = p_prize, approved_at = now() where week = p_week;
    return json_build_object('ok', true, 'status', 'approved', 'job', w.job_id);
  end if;
  select * into t from inf_week_top(p_week, w.skipped || w.job_id);
  if not found then
    update agi1_inf_weeks set skipped = skipped || w.job_id, status = 'none', job_id = null, inf_id = null, wallet_code = null,
      holder_likes = 0, likes = 0, picked_at = now()
    where week = p_week;
    return json_build_object('ok', true, 'status', 'none', 'job', null);
  end if;
  update agi1_inf_weeks set skipped = skipped || w.job_id, status = 'picked', job_id = t.job_id, inf_id = t.inf_id,
    wallet_code = t.wallet_code, holder_likes = t.holder_likes, likes = t.likes, picked_at = now()
  where week = p_week;
  return json_build_object('ok', true, 'status', 'picked', 'job', t.job_id);
end;
$$;

-- The weeks, the newest first (p_wallet: a signed-in wallet's own are marked "mine": its prize to claim). The owner's page
-- sees every state; the pages show approved ones.
create or replace function public.inf_weeks(p_wallet text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('week', w.week, 'status', w.status, 'job', w.job_id, 'inf_id', w.inf_id,
      'holder_likes', w.holder_likes, 'likes', w.likes, 'prize', w.prize, 'tx', w.tx, 'kind', j.kind, 'shape', j.shape,
      'poster', j.poster, 'files', j.files, 'job_ok', coalesce(j.status = 'done' and not j.hidden, false), 'inf_name', i.name,
      'looks_job', i.looks_job, 'pick', i.pick, 'skipped', cardinality(w.skipped),
      'mine', coalesce(w.wallet_code = p_wallet, false)) order by w.week desc), '[]'::json)
  from (select * from agi1_inf_weeks order by week desc limit least(greatest(coalesce(p_limit, 8), 1), 60)) w
  left join agi1_inf_jobs j on j.id = w.job_id left join agi1_inf i on i.id = w.inf_id;
$$;

-- Its maker claims a week's prize, to the wallet they're signed in with (p_address: its address, checked by our server; it
-- made the creation: p_wallet is its code), once (a claim that never got as far as sending is given back after 2 minutes).
-- → {"ok": true, "amount", "address"} or {"ok": false, "why": "none" | "not_yours" | "no_prize" | "approved"… (its state),
--   "tx", "amount"}
create or replace function public.inf_week_claim(p_week date, p_wallet text, p_address text)
returns json
language plpgsql
set search_path = public
as $$
declare
  w agi1_inf_weeks%rowtype;
begin
  if p_week is null or p_wallet is null or p_address is null or lower(p_address) !~ '^0x[0-9a-f]{40}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  update agi1_inf_weeks set status = 'claimed', address = lower(p_address), claimed_at = now()
  where week = p_week and wallet_code = p_wallet and prize > 0
    and (status = 'approved' or (status = 'claimed' and claimed_at < now() - interval '2 minutes'))
  returning * into w;
  if found then return json_build_object('ok', true, 'amount', w.prize, 'address', w.address); end if;
  select * into w from agi1_inf_weeks where week = p_week;
  if not found or w.status in ('none', 'picked') then return json_build_object('ok', false, 'why', 'none'); end if;
  if w.wallet_code is distinct from p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if w.prize = 0 then return json_build_object('ok', false, 'why', 'no_prize'); end if;
  return json_build_object('ok', false, 'why', w.status, 'tx', w.tx, 'amount', w.prize);
end;
$$;

-- Its prize's transaction, kept right before it's sent (so it's never sent twice) → true / false
create or replace function public.inf_week_sending(p_week date, p_tx text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then return false; end if;
  update agi1_inf_weeks set status = 'sending', tx = p_tx where week = p_week and status in ('claimed', 'sending');
  return found;
end;
$$;

-- How sending went: sent (with its transaction), or nothing went out (back to approved: they can claim again; also a prize
-- whose transaction p_tx failed on the chain, so its $AGI never moved) → true / false
create or replace function public.inf_week_sent(p_week date, p_tx text, p_ok boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_ok then
    if p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then return false; end if;
    update agi1_inf_weeks set status = 'sent', tx = p_tx, sent_at = now() where week = p_week and status in ('claimed', 'sending');
  else
    update agi1_inf_weeks set status = 'approved', tx = null, address = null, sent_at = null
    where week = p_week and (status in ('claimed', 'sending') or (status = 'sent' and p_tx is not null and tx = p_tx));
  end if;
  return found;
end;
$$;

-- ---------- burn unlocks (round 2: a boost in Explore, one more influencer) ----------
-- A quote for one (p_what: 'boost' for one of its own public influencers, for p_hours; or 'slot'), p_agi whole $AGI to burn
-- from the wallet's own app. Asked again while one is open (in its day, or with something burned toward it): the same one.
-- → {"ok": true, "id", "agi", "paid", "created", "again"} or {"ok": false, "why": "gone" | "not_yours" | "not_ready" |
--   "private" | "too_many" | "taken" | "bad"}
create or replace function public.inf_burn_quote(p_id text, p_wallet text, p_burn text, p_what text, p_inf text, p_agi bigint, p_hours integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  i agi1_inf%rowtype;
  b agi1_inf_burns%rowtype;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_burn is null or char_length(p_burn) not between 16 and 64 or p_what is null or p_what not in ('boost', 'slot')
     or (p_what = 'boost') <> (p_inf is not null) or (p_inf is not null and p_inf !~ '^[A-Za-z0-9_-]{22}$')
     or p_agi is null or p_agi not between 1 and 1000000000
     or p_hours is null or (p_what = 'boost' and p_hours not between 1 and 720) or (p_what = 'slot' and p_hours <> 0) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  if p_what = 'boost' then
    select * into i from agi1_inf where id = p_inf;
    if not found or i.status = 'deleted' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
    if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
    if i.status <> 'ready' then return json_build_object('ok', false, 'why', 'not_ready'); end if;
    if not i.public or i.mode = 'face' or i.real then return json_build_object('ok', false, 'why', 'private'); end if;
  end if;
  select * into b from agi1_inf_burns where wallet_code = p_wallet and what = p_what and inf_id is not distinct from p_inf
    and status = 'quote' and (paid > 0 or created_at > now() - interval '1 day') order by created_at desc limit 1;
  if found then
    return json_build_object('ok', true, 'id', b.id, 'agi', b.agi, 'paid', b.paid, 'created', b.created_at, 'again', true);
  end if;
  if (select count(*) from agi1_inf_burns where wallet_code = p_wallet and status = 'quote' and paid = 0
      and created_at > now() - interval '1 day') >= 4 then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_burns (id, wallet_code, burn_code, what, inf_id, agi, hours) values (p_id, p_wallet, p_burn, p_what, p_inf, p_agi, p_hours)
  on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  return json_build_object('ok', true, 'id', p_id, 'agi', p_agi, 'paid', 0, 'created', now(), 'again', false);
end;
$$;

-- One burn toward it, read on Robinhood Chain by our server, counted once (p_tx its code; in studio.sql's payment ledger and
-- burns.sql's own, so it never counts for messages or a character too), its $AGI added to the wallet's (toward its level).
-- Burns add up; once it's all burned, it's unlocked: a boost (until: from now, or the end of a boost already on) or a slot.
-- → {"ok": true, "paid": true|false, "have", "need", "until"} or {"ok": false, "why": "gone" | "not_yours" | "done" | "used" | "bad"}
create or replace function public.inf_burn_pay(p_id text, p_wallet text, p_tx text, p_amount numeric)
returns json
language plpgsql
set search_path = public
as $$
declare
  b agi1_inf_burns%rowtype;
  have numeric;
  v_until timestamptz;
begin
  if p_id is null or p_wallet is null or p_tx is null or char_length(p_tx) not between 16 and 64
     or p_amount is null or p_amount <= 0 or p_amount > 1000000000 or p_amount <> trunc(p_amount) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into b from agi1_inf_burns where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if b.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if b.status <> 'quote' then return json_build_object('ok', false, 'why', 'done'); end if;
  if b.paid = 0 and b.created_at < now() - interval '1 day' then return json_build_object('ok', false, 'why', 'gone'); end if;
  insert into agi1_studio_txs (tx_code, kind, order_id) values (p_tx, 'burn', p_id) on conflict (tx_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'used'); end if;
  insert into agi1_burn_txs (tx_code) values (p_tx) on conflict (tx_code) do nothing;
  if not found then
    delete from agi1_studio_txs where tx_code = p_tx;            -- counted for messages already: never twice
    return json_build_object('ok', false, 'why', 'used');
  end if;
  insert into agi1_burn_wallets as w (wallet_code, agi) values (b.burn_code, p_amount)
  on conflict (wallet_code) do update set agi = w.agi + excluded.agi;
  have := b.paid + p_amount;
  if have < b.agi then
    update agi1_inf_burns set paid = have where id = p_id;
    return json_build_object('ok', true, 'paid', false, 'have', have, 'need', b.agi);
  end if;
  update agi1_inf_burns set paid = have, status = 'paid', paid_at = now() where id = p_id;
  if b.what = 'boost' then
    update agi1_inf set boost_until = greatest(coalesce(boost_until, now()), now()) + make_interval(hours => b.hours), updated_at = now()
    where id = b.inf_id returning boost_until into v_until;
  else
    insert into agi1_inf_slots as s (wallet_code, extra) values (b.wallet_code, 1)
    on conflict (wallet_code) do update set extra = least(s.extra + 1, 1000);
  end if;
  return json_build_object('ok', true, 'paid', true, 'have', have, 'need', b.agi, 'until', v_until);
end;
$$;

-- A burn unlock as our server needs it (expired: a quote nothing was burned toward, a day old)
create or replace function public.inf_burn_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(b) from (
    select id, wallet_code, burn_code, what, inf_id, agi, hours, paid, status, created_at, paid_at,
      (status = 'quote' and paid = 0 and created_at < now() - interval '1 day') as expired
    from agi1_inf_burns where id = p_id
  ) b;
$$;

-- A wallet's open burn unlocks (and the ones it finished this week), the newest first
create or replace function public.inf_burns_open(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'what', what, 'inf_id', inf_id, 'agi', agi, 'hours', hours, 'paid', paid,
      'status', status, 'created_at', created_at, 'paid_at', paid_at) order by created_at desc), '[]'::json)
  from (select * from agi1_inf_burns where wallet_code = p_wallet
    and ((status = 'quote' and (paid > 0 or created_at > now() - interval '1 day')) or (status = 'paid' and paid_at > now() - interval '7 days'))
    order by created_at desc limit 20) b;
$$;

-- A wallet's influencers (not deleted or failed) and the extra ones it unlocked by burning → {"used", "extra"}
create or replace function public.inf_slots(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'used', (select count(*) from agi1_inf where wallet_code = p_wallet and status in ('looks', 'pick', 'body', 'ready')),
    'extra', coalesce((select extra from agi1_inf_slots where wallet_code = p_wallet), 0));
$$;

-- ---------- the live stats board (round 2: public totals only, cached a minute) ----------
create or replace function public.inf_stats()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'influencers', (select count(*) from agi1_inf where status = 'ready'),
    'photos', (select count(*) from agi1_inf_jobs where kind = 'photo' and status = 'done'),
    'videos', (select count(*) from agi1_inf_jobs where kind in ('trend', 'video') and status = 'done'),
    'models', (select count(*) from agi1_studio_orders where inf_id is not null and status = 'done'),
    'today', (select count(*) from agi1_inf_jobs where kind in ('photo', 'trend', 'video') and status = 'done'
      and done_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')),
    'likes', (select coalesce(sum(likes), 0) from agi1_inf_jobs where likes > 0),
    'burned', coalesce((select sum(paid) from agi1_studio_orders where kind = 'burn'), 0) + coalesce((select sum(paid) from agi1_inf_burns), 0),
    'boosted', (select count(*) from agi1_inf where boost_until > now() and status = 'ready' and public and not hidden and mode <> 'face' and not real));
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
  -- (round 2) burn quotes nothing was burned toward go after 2 days; a sent prize's address after 60 days (its transaction stays)
  delete from agi1_inf_burns where status = 'quote' and paid = 0 and created_at < now() - interval '2 days';
  update agi1_inf_weeks set address = null where status = 'sent' and address is not null and sent_at < now() - interval '60 days';
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
    'inf_upload_set(text, text, text, numeric, boolean)', 'inf_day_take(integer)',
    'inf_start(text, text, text, text, text, text, jsonb, text, text, integer, integer, integer, integer, integer)', 'inf_get(text)',
    'inf_pick(text, text, integer, text)', 'inf_reroll(text, text, text, integer, integer)',
    'inf_make(text, text, text, text, text, text, boolean, text, text, text, integer, integer, integer)', 'inf_job_get(text)',
    'inf_job_lease(text, integer)', 'inf_job_step(text, text, text, text, boolean, integer)', 'inf_job_wait(text)',
    'inf_job_done(text, integer, integer)', 'inf_job_fail(text, text, boolean)', 'inf_job_due(integer)', 'inf_poster(text)',
    'inf_jobs(text, text, integer)', 'inf_mine(text, integer)', 'inf_explore(integer)', 'inf_public(text, text, boolean)',
    'inf_delete(text, text)', 'inf_hide(text, boolean)', 'inf_job_hide(text, boolean)',
    'inf_3d(text, text, text, text, integer, integer, integer, boolean)', 'inf_3d_back(text)', 'inf_3d_list(text)',
    'trend_make(text, text, integer)', 'trend_set(text, text)', 'trend_list()', 'inf_report(text, text, text, text, integer)',
    'inf_reports(integer)', 'inf_report_clear(text, text)', 'inf_tidy()',
    -- round 2
    'inf_3d_burn(text, text, text, text, integer, bigint, integer, integer)', 'inf_example_make(text, text)', 'inf_examples()',
    'inf_mark_take()', 'inf_mark_done(text)', 'inf_like(text, text, integer, boolean, integer)', 'inf_liked(text, text[])',
    'inf_week_top(date, text[])', 'inf_week_pick(date)', 'inf_week_set(date, text, bigint)', 'inf_weeks(text, integer)',
    'inf_week_claim(date, text, text)', 'inf_week_sending(date, text)', 'inf_week_sent(date, text, boolean)',
    'inf_burn_quote(text, text, text, text, text, bigint, integer)', 'inf_burn_pay(text, text, text, numeric)', 'inf_burn_get(text)',
    'inf_burns_open(text)', 'inf_slots(text)', 'inf_stats()',
    -- round 3
    'inf_gift(text, integer, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: influencers_ready = 1 (its 60 functions, each exactly once: since round 2 an older inf_start or inf_upload_set left
-- behind would count twice; round 2's new columns; round 3's gifts in the credits' log; and studio.sql's new parts it builds on)
select
  (case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('inf_credits', 'inf_spend', 'inf_refund',
    'inf_topup', 'inf_free', 'inf_upload_open', 'inf_upload_get', 'inf_upload_set', 'inf_day_take', 'inf_start', 'inf_get', 'inf_pick',
    'inf_reroll', 'inf_make', 'inf_job_get', 'inf_job_lease', 'inf_job_step', 'inf_job_wait', 'inf_job_done', 'inf_job_fail',
    'inf_job_due', 'inf_poster', 'inf_jobs', 'inf_mine', 'inf_explore', 'inf_public', 'inf_delete', 'inf_hide', 'inf_job_hide',
    'inf_3d', 'inf_3d_back', 'inf_3d_list', 'trend_make', 'trend_set', 'trend_list', 'inf_report', 'inf_reports',
    'inf_report_clear', 'inf_tidy',
    'inf_3d_burn', 'inf_example_make', 'inf_examples', 'inf_mark_take', 'inf_mark_done', 'inf_like', 'inf_liked', 'inf_week_top',
    'inf_week_pick', 'inf_week_set', 'inf_weeks', 'inf_week_claim', 'inf_week_sending', 'inf_week_sent', 'inf_burn_quote',
    'inf_burn_pay', 'inf_burn_get', 'inf_burns_open', 'inf_slots', 'inf_stats', 'inf_gift')) = 60 then 1 else 0 end)
    * (case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_studio_orders'
        and column_name = 'image_path') then 1 else 0 end)
    * (case when (select count(*) from information_schema.columns where table_schema = 'public'
        and ((table_name = 'agi1_inf' and column_name in ('real', 'boost_until'))
          or (table_name = 'agi1_inf_uploads' and column_name = 'real')
          or (table_name = 'agi1_inf_jobs' and column_name in ('example', 'marked', 'mark_tries', 'mark_at', 'likes')))) = 8 then 1 else 0 end)
    * (case when exists (select 1 from pg_constraint where conrelid = 'public.agi1_credit_log'::regclass
        and conname = 'agi1_credit_log_kind_check' and pg_get_constraintdef(oid) like '%gift%') then 1 else 0 end)
    as influencers_ready;
