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
--   agi1_credits        per wallet code: its credits (bought, and this month's free ones; since round 4's phase 3 its bonus
--                       ones too)
--   agi1_credit_log     each top-up, spend, refund and free grant, and (round 3) each gift from the owner (its wallet code,
--                       the amount, what it was for); since round 4's phase 3 each gift sent, got, held in a gift link or given
--                       back, and each invite's reward (with who the gift's other side was, as the page shows it)
--   agi1_credit_months  per month: the free credits given out (the whole site's cap)
--   agi1_inf_uploads    each picture, selfie or clip uploaded: its wallet code, its kind, whether the AI check passed it, a
--                       clip's length (the files are deleted within 2 days, a selfie or picture as soon as its influencer is
--                       made)
--   agi1_inf_trends     the trend moves (the owner's): their state and their video's job
--   agi1_inf_reports    reports of an influencer or one of its videos: why, and a daily code of who reported (never an IP)
--   agi1_inf_days       per day: the AI jobs started (the whole site's cap), and (round 4) the AI captions written
--   agi1_inf_names      (round 4) per wallet code: the clank.trade username it showed (public on clank.trade: our server
--                       checked that profile's wallet is this one) and when it was last checked
--   agi1_inf_caption_days (round 4) per wallet code and day: the AI captions it asked for (kept 2 days)
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
-- Round 4 (2026-10-11, the owner's next list: a percentage while things are made, "the banner on their X as well with the
-- right size", "ready made captions on their posts, or they can generate one too", and "their username [on clank.trade] will
-- appear also on the studio"). Run this file again (it keeps everything saved). It adds:
--   • X banners: a photo may be the shape 'banner' (1500 × 500, cut on our server), only a photo, and never what a video or a
--     trend video starts from (inf_make)
--   • clank.trade usernames (agi1_inf_names: per scrambled wallet code, the clank.trade username our server checked belongs
--     to that wallet's own clank.trade profile, and when it last checked): shown as "by @name" on its public influencers
--   • captions written by AI for a post (agi1_inf_caption_days: per wallet code and day, how many; agi1_inf_days.captions:
--     the whole site's a day): counted before the AI is asked
--   • when what's being made started, for its progress bar (inf_get's job, inf_3d_list)
-- Round 4, phase 2 (2026-10-11, the owner's list: an owner's tab with the AI services' balances, stats and alerts on Telegram
-- when a balance is low; roles; "Mod tools and customer support"; support with an AI helper and tickets). Run this file again
-- (it keeps everything saved). It adds:
--   • the team (agi1_inf_staff: per scrambled wallet code, its role ('mod' or 'support'), the nickname the owner gave it and
--     its short address "0x12ab…cdef"), added and removed by the owner
--   • bans (agi1_inf_bans: a wallet that may not make anything any more, why, the team's note, who did it and when it was
--     lifted; agi1_inf.banned: its influencers shown to nobody but itself). inf_start, inf_make, inf_reroll, inf_3d and
--     inf_3d_burn say "banned"; Explore, likes, the spotlight and the stats leave a banned wallet's out
--   • support tickets (agi1_inf_tickets and agi1_inf_ticket_msgs: a wallet's question, its topic and the messages, its own
--     words or the team's; closed ones go after 90 days)
--   • the AI helper's answers a day (agi1_inf_help_days: per wallet code or a signed-out visitor's daily code; kept 2 days;
--     agi1_inf_days.helps: the whole site's), and the tickets opened a day (agi1_inf_days.tickets)
--   • alerts on Telegram (agi1_inf_alerts: the chats that get them, from her bot: the owner's and the team's; a Telegram
--     chat's number, needed to write to it) and the owner's settings and the clock's claims (agi1_inf_admin)
--   • the owner's numbers (inf_admin_stats: totals only)
-- Round 4, phase 3 (2026-10-11, the owner's list: "gifting bought credits only" (to a wallet, an @name or a gift link; at most
-- 50,000 credits a day) and invites for credits only (a friend's 100 credits with its first top-up; its inviter 10% of what it
-- buys, at most 500 from one friend and 5,000 a month)). Run this file again (it keeps everything saved). It adds:
--   • bonus credits (agi1_credits.bonus): an invite's reward, a friend's welcome credits and, since then, the owner's credits
--     for testing. Spent after this month's free ones and before bought ones, given back when something can't be made, never
--     run out, and never passed on as a gift (only bought credits are)
--   • gifts (agi1_credit_gifts: who it was from and to, as scrambled wallet codes and as the page shows them (a clank.trade name,
--     or a short address "0x12ab…cdef"), how many credits, a short note, and a gift link's secret until it's claimed, taken
--     back or past its days (then its credits go back to its sender)); each one in agi1_credit_log too
--   • invites (agi1_inf_refs: each wallet's invite code; agi1_inf_invited: the wallets that joined through one, whether their
--     welcome credits came and what their inviter earned from them; agi1_inf_ref_months: what an inviter earned a month;
--     agi1_inf_ref_paid: each friend's top-up counted once)

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
-- a gift is a kind of its own in the credits' log (an older check, without it, goes first); and (round 4, phase 3) a gift sent,
-- got, held in a gift link or given back, an invite's reward and a friend's welcome credits (all of today's kinds here: run
-- again over a log that has them, an older list would refuse them)
alter table public.agi1_credit_log drop constraint if exists agi1_credit_log_kind_check;
alter table public.agi1_credit_log add constraint agi1_credit_log_kind_check
  check (kind in ('topup', 'spend', 'refund', 'free', 'gift', 'send', 'receive', 'hold', 'unhold', 'ref', 'welcome'));

-- ---------- round 4 (2026-10-11): X banners, clank.trade usernames, captions ----------
-- a photo may be an X banner (1500 × 500); only a photo (an older check, without it, goes first)
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_shape_check;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_shape_check check (shape in ('tall', 'wide', 'square', 'banner'));
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_banner_check;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_banner_check check (shape is distinct from 'banner' or kind = 'photo');
-- the clank.trade username a wallet showed (lowercase, clank.trade's own rule: 3 to 32 letters, numbers or _), once our
-- server read its clank.trade profile and its wallet was this one; one wallet per name (a newer check takes it over)
create table if not exists public.agi1_inf_names (
  wallet_code text        primary key check (char_length(wallet_code) between 16 and 64),
  name        text        not null check (name ~ '^[a-z0-9_]{3,32}$'),
  checked_at  timestamptz not null default now()
);
create unique index if not exists agi1_inf_names_name on public.agi1_inf_names (name);
-- captions written by AI: per wallet code and day (UTC), and the whole site's a day
create table if not exists public.agi1_inf_caption_days (
  wallet_code text    not null check (char_length(wallet_code) between 16 and 64),
  day         date    not null,
  n           integer not null default 0 check (n >= 0),
  primary key (wallet_code, day)
);
alter table public.agi1_inf_days add column if not exists captions integer not null default 0 check (captions >= 0);
alter table public.agi1_inf_names enable row level security;
alter table public.agi1_inf_caption_days enable row level security;
revoke all on table public.agi1_inf_names, public.agi1_inf_caption_days from anon, authenticated;

-- ---------- round 4, phase 2 (2026-10-11): the owner's tab, the team (mods and support), bans, support tickets, the AI
-- helper's counts, alerts on Telegram ----------
-- the team: a wallet the owner added by its address (kept only as a scrambled code, its short form "0x12ab…cdef" to tell
-- them apart, and the nickname the owner gave it), and its role: 'mod' (reports, bans and tickets) or 'support' (tickets)
create table if not exists public.agi1_inf_staff (
  wallet_code text        primary key check (char_length(wallet_code) between 16 and 64),
  role        text        not null check (role in ('mod', 'support')),
  nick        text        not null check (char_length(nick) between 2 and 24),
  short       text        not null check (short ~ '^0x[0-9a-f]{4}…[0-9a-f]{4}$'),
  added_at    timestamptz not null default now()
);
-- bans: a wallet that may not make anything in AGI Studio any more (its influencers hidden from everyone but itself), why,
-- the team's own note (never shown to the person), who banned it (its nickname), and when it was lifted (one live ban a wallet)
create table if not exists public.agi1_inf_bans (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  inf_id      text        check (inf_id ~ '^[A-Za-z0-9_-]{22}$'),                -- the influencer it was for
  reason      text        not null check (reason in ('real_person', 'minor', 'sexual', 'hate', 'violence', 'copyright', 'spam', 'scam', 'other')),
  note        text        check (char_length(note) <= 200),
  by_nick     text        not null check (char_length(by_nick) between 2 and 24),
  at          timestamptz not null default now(),
  lifted_at   timestamptz,
  lifted_by   text        check (char_length(lifted_by) between 2 and 24)
);
create unique index if not exists agi1_inf_bans_live on public.agi1_inf_bans (wallet_code) where lifted_at is null;
alter table public.agi1_inf add column if not exists banned boolean not null default false;
-- support tickets: a wallet's question to the team (its topic; 'open' waits for the team, 'answered' for the person), and
-- its messages (the person's own words, or the team's: which of them, by nickname; the person sees "AGI Studio support")
create table if not exists public.agi1_inf_tickets (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  topic       text        not null check (topic in ('payment', 'making', 'account', 'bug', 'other')),
  status      text        not null default 'open' check (status in ('open', 'answered', 'closed')),
  user_seen   boolean     not null default true,                                  -- the person read the team's newest reply
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists agi1_inf_tickets_wallet on public.agi1_inf_tickets (wallet_code, updated_at);
create index if not exists agi1_inf_tickets_status on public.agi1_inf_tickets (status, updated_at);
create table if not exists public.agi1_inf_ticket_msgs (
  id          bigint      generated always as identity primary key,
  ticket_id   text        not null references public.agi1_inf_tickets (id) on delete cascade,
  from_staff  boolean     not null,
  by_nick     text        check (char_length(by_nick) between 2 and 24),
  body        text        not null check (char_length(body) between 1 and 1000),
  at          timestamptz not null default now()
);
create index if not exists agi1_inf_ticket_msgs_ticket on public.agi1_inf_ticket_msgs (ticket_id, id);
-- the AI helper's answers: per wallet code (or a signed-out visitor's daily code) and day, and the whole site's a day; and the
-- tickets opened a day (the whole site's cap)
create table if not exists public.agi1_inf_help_days (
  who         text        not null check (char_length(who) between 16 and 64),
  day         date        not null,
  n           integer     not null default 0 check (n >= 0),
  primary key (who, day)
);
alter table public.agi1_inf_days add column if not exists helps integer not null default 0 check (helps >= 0);
alter table public.agi1_inf_days add column if not exists tickets integer not null default 0 check (tickets >= 0);
-- alerts on Telegram: the chats that get them (the owner's, and the team's: a member's are deleted with them), from her bot
create table if not exists public.agi1_inf_alerts (
  chat_id     bigint      primary key check (chat_id > 0),
  who         text        not null check (who = 'owner' or char_length(who) between 16 and 64),
  added_at    timestamptz not null default now()
);
-- the owner's settings (low-balance thresholds) and the clock's claims (each alert's last time: never sent twice)
create table if not exists public.agi1_inf_admin (
  key         text        primary key check (key ~ '^[a-z][a-z0-9_:-]{1,40}$'),
  value       jsonb       not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  at          timestamptz not null default now()
);
alter table public.agi1_inf_staff enable row level security;
alter table public.agi1_inf_bans enable row level security;
alter table public.agi1_inf_tickets enable row level security;
alter table public.agi1_inf_ticket_msgs enable row level security;
alter table public.agi1_inf_help_days enable row level security;
alter table public.agi1_inf_alerts enable row level security;
alter table public.agi1_inf_admin enable row level security;
revoke all on table public.agi1_inf_staff, public.agi1_inf_bans, public.agi1_inf_tickets, public.agi1_inf_ticket_msgs,
  public.agi1_inf_help_days, public.agi1_inf_alerts, public.agi1_inf_admin from anon, authenticated;

-- ---------- round 4, phase 3 (2026-10-11): gifts of credits, and invites ----------
-- bonus credits (an invite's reward, a friend's welcome credits, the owner's credits for testing): spent after this month's
-- free ones and before bought ones, never passed on as a gift; and in the credits' log, what part of a spend (or its refund)
-- was bonus, and the other side of a gift as the page shows it ("@name", "0x12ab…cdef" or "a gift link")
alter table public.agi1_credits add column if not exists bonus integer not null default 0 check (bonus between 0 and 100000000);
alter table public.agi1_credit_log add column if not exists bonus_part integer not null default 0 check (bonus_part >= 0);
alter table public.agi1_credit_log add column if not exists other text check (char_length(other) between 1 and 40);
-- gifts of bought credits: to a wallet ('sent': by its address or the clank.trade name it shows here), or a gift link ('open'
-- until someone claims it once, its sender takes it back or its days pass: then its credits go back). Who it was from and to,
-- as scrambled wallet codes and as the page shows them, a short note, and whether its recipient saw it.
create table if not exists public.agi1_credit_gifts (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  token       text        unique check (token ~ '^[A-Za-z0-9_-]{22}$'),                     -- a gift link's secret
  from_code   text        not null check (char_length(from_code) between 16 and 64),
  from_label  text        not null check (char_length(from_label) between 3 and 40),
  to_code     text        check (char_length(to_code) between 16 and 64),
  to_label    text        check (char_length(to_label) between 3 and 40),
  credits     integer     not null check (credits between 1 and 1000000),
  note        text        check (char_length(note) between 1 and 80),
  status      text        not null check (status in ('sent', 'open', 'claimed', 'canceled', 'expired')),
  seen        boolean     not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  done_at     timestamptz,
  check ((token is null) = (status = 'sent')),
  check (from_code is distinct from to_code)
);
create index if not exists agi1_credit_gifts_from on public.agi1_credit_gifts (from_code, created_at);
create index if not exists agi1_credit_gifts_to on public.agi1_credit_gifts (to_code, created_at);
create index if not exists agi1_credit_gifts_open on public.agi1_credit_gifts (expires_at) where status = 'open';
-- invites: each wallet's invite code; the wallets that joined through one (a wallet that never bought credits, once: never
-- its own code, never the wallet it invited), whether their welcome credits came and what their inviter earned from them;
-- what an inviter earned a month (its cap); each friend's top-up counted once (its code in the credits' log)
create table if not exists public.agi1_inf_refs (
  wallet_code text        primary key check (char_length(wallet_code) between 16 and 64),
  code        text        not null unique check (code ~ '^[a-hj-km-np-z2-9]{8}$'),
  created_at  timestamptz not null default now()
);
create table if not exists public.agi1_inf_invited (
  wallet_code text        primary key check (char_length(wallet_code) between 16 and 64),
  by_code     text        not null check (char_length(by_code) between 16 and 64),
  at          timestamptz not null default now(),
  welcomed    boolean     not null default false,
  earned      integer     not null default 0 check (earned between 0 and 100000000),
  check (wallet_code <> by_code)
);
create index if not exists agi1_inf_invited_by on public.agi1_inf_invited (by_code, at);
create table if not exists public.agi1_inf_ref_months (
  wallet_code text        not null check (char_length(wallet_code) between 16 and 64),
  month       date        not null,
  earned      integer     not null default 0 check (earned >= 0),
  primary key (wallet_code, month)
);
create table if not exists public.agi1_inf_ref_paid (
  tx_ref      text        primary key check (char_length(tx_ref) between 1 and 80),
  friend_code text        not null check (char_length(friend_code) between 16 and 64),
  reward      integer     not null default 0 check (reward >= 0),
  welcome     integer     not null default 0 check (welcome >= 0),
  at          timestamptz not null default now()
);
alter table public.agi1_credit_gifts enable row level security;
alter table public.agi1_inf_refs enable row level security;
alter table public.agi1_inf_invited enable row level security;
alter table public.agi1_inf_ref_months enable row level security;
alter table public.agi1_inf_ref_paid enable row level security;
revoke all on table public.agi1_credit_gifts, public.agi1_inf_refs, public.agi1_inf_invited, public.agi1_inf_ref_months,
  public.agi1_inf_ref_paid from anon, authenticated;

-- ---------- round 4, phase 4 (2026-10-11): the model menu, long videos, memes ----------
-- a photo's or a video's model, quality and seconds (the model menu: src/studio/rules.js PHOTO_MODELS, VIDEO_MODELS; none on
-- what was made before it: Classic, or Standard for 5 s), its reference pictures (the person's own uploads of a thing, a place,
-- a pet, food or a style, kind 'ref': up to 4), a long video's parts (Kling in parts of up to 15 s, each from the last frame of
-- the one before: parts, and part, the one being made; part = parts while they're joined), and a meme's format and words (a
-- meme is a photo; two lines are kept as "top\nbottom")
alter table public.agi1_inf_jobs add column if not exists model text check (model in ('classic', 'crisp', 'standard', 'pro', 'anime', 'long'));
alter table public.agi1_inf_jobs add column if not exists quality text check (quality in ('std', 'hd', 'ultra', '480p', '720p'));
alter table public.agi1_inf_jobs add column if not exists seconds smallint check (seconds between 3 and 60);
alter table public.agi1_inf_jobs add column if not exists refs text[] check (refs is null or (cardinality(refs) between 1 and 4
  and array_to_string(refs, ',') ~ '^[A-Za-z0-9_-]{22}(,[A-Za-z0-9_-]{22}){0,3}$'));
alter table public.agi1_inf_jobs add column if not exists parts smallint not null default 1 check (parts between 1 and 4);
alter table public.agi1_inf_jobs add column if not exists part smallint not null default 0 check (part between 0 and 4);
alter table public.agi1_inf_jobs add column if not exists meme text check (meme ~ '^[a-z]{2,12}$');
alter table public.agi1_inf_jobs add column if not exists caption text check (char_length(caption) between 1 and 130);
alter table public.agi1_inf_jobs drop constraint if exists agi1_inf_jobs_menu_check;
alter table public.agi1_inf_jobs add constraint agi1_inf_jobs_menu_check check (
  (model is null or (kind = 'photo' and model in ('classic', 'crisp')) or (kind = 'video' and model in ('standard', 'pro', 'anime', 'long')))
  and (meme is null or (kind = 'photo' and caption is not null and model is distinct from 'crisp')) and (caption is null or meme is not null)
  and part <= parts and (parts = 1 or (kind = 'video' and model = 'long')));
-- a reference picture is an upload of its own kind (an older check, without it, goes first)
alter table public.agi1_inf_uploads drop constraint if exists agi1_inf_uploads_kind_check;
alter table public.agi1_inf_uploads add constraint agi1_inf_uploads_kind_check check (kind in ('picture', 'face', 'clip', 'ref'));

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
-- A wallet's credits now: { paid (bought, and gifts it got), free (this month's), month, and (round 4, phase 3) bonus (an
-- invite's reward, its welcome credits, the owner's credits for testing), bought (it ever bought credits), invited (it joined
-- through an invite), welcomed (its welcome credits came), got and got_n (the credits in gifts it got and hasn't seen yet) }
create or replace function public.inf_credits(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('paid', coalesce(c.paid, 0),
    'free', case when c.free_month = studio_this_month() then c.free else 0 end, 'month', studio_this_month(),
    'bonus', coalesce(c.bonus, 0),
    'bought', exists (select 1 from agi1_credit_log l where l.wallet_code = p_wallet and l.kind = 'topup'),
    'invited', v.wallet_code is not null, 'welcomed', coalesce(v.welcomed, false),
    'got', (select coalesce(sum(g.credits), 0) from agi1_credit_gifts g where g.to_code = p_wallet and not g.seen),
    'got_n', (select count(*) from agi1_credit_gifts g where g.to_code = p_wallet and not g.seen))
  from (select 1) one left join agi1_credits c on c.wallet_code = p_wallet
    left join agi1_inf_invited v on v.wallet_code = p_wallet;
$$;

-- Credits spent on something (p_ref: its job's or 3D model's id): this month's free ones first, then (round 4, phase 3) bonus
-- ones, then bought ones (so what's left to give as a gift lasts longest). Once per p_ref. → {"ok": true, "paid", "free",
-- "bonus"} or {"ok": false, "why": "short" (with what it has) | "taken" | "bad"}
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
  bp integer;
  pp integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_cost is null or p_cost not between 0 and 100000
     or p_ref is null or char_length(p_ref) not between 1 and 80 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  select * into c from agi1_credits where wallet_code = p_wallet for update;
  f := case when c.free_month = m then c.free else 0 end;
  if f + c.bonus + c.paid < p_cost then
    return json_build_object('ok', false, 'why', 'short', 'paid', c.paid, 'free', f, 'bonus', c.bonus);
  end if;
  fp := least(f, p_cost);
  bp := least(c.bonus, p_cost - fp);
  pp := p_cost - fp - bp;
  begin
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, bonus_part, month, ref)
    values (p_wallet, 'spend', p_cost, pp, fp, bp, m, p_ref);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  update agi1_credits set paid = paid - pp, free = f - fp, bonus = bonus - bp, updated_at = now() where wallet_code = p_wallet;
  return json_build_object('ok', true, 'paid', c.paid - pp, 'free', f - fp, 'bonus', c.bonus - bp);
end;
$$;

-- What was spent on p_ref, given back once: bought credits always (and since round 4's phase 3 bonus ones), this month's free
-- ones only while it's still that month (they'd have run out anyway). → true (given back) or false (nothing spent on it, or
-- given back already)
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
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, bonus_part, month, ref)
    values (l.wallet_code, 'refund', l.paid_part + back_free + l.bonus_part, l.paid_part, back_free, l.bonus_part, m, p_ref);
  exception when unique_violation then
    return false;
  end;
  update agi1_credits set paid = least(paid + l.paid_part, 100000000), bonus = least(bonus + l.bonus_part, 100000000),
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
-- (p_wallet: its scrambled code; p_ref: this gift's own id, so a gift counts once). They never run out, and what's spent from
-- them is given back the same way when something can't be made. Since round 4's phase 3 they're bonus credits (spent before
-- bought ones, never passed on as a gift: "gifting bought credits only"); before, they were added to bought ones. Nothing is
-- paid to anyone; what they're spent on is paid from the owner's own AI balance. Only our server calls it, and only for the
-- owner's wallet. → {"ok": true, "paid", "bonus"} or {"ok": false, "why": "taken" | "bad"}
create or replace function public.inf_gift(p_wallet text, p_credits integer, p_ref text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_paid integer;
  v_bonus integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_credits is null or p_credits not between 1 and 100000
     or p_ref is null or p_ref !~ '^[A-Za-z0-9_-]{22}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  begin
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, free_part, bonus_part, ref)
    values (p_wallet, 'gift', p_credits, 0, 0, p_credits, p_ref);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  update agi1_credits set bonus = least(bonus + p_credits, 100000000), updated_at = now() where wallet_code = p_wallet
  returning paid, bonus into v_paid, v_bonus;
  return json_build_object('ok', true, 'paid', v_paid, 'bonus', v_bonus);
end;
$$;

-- ---------- (round 4, phase 3) gifts of credits, and invites ----------
-- A gift of bought credits from p_from to another wallet: p_to (its code, given by its address) or p_to_name (the clank.trade
-- name it shows here). p_from_label and p_to_label: how the page shows them ("@name", or a short address "0x12ab…cdef"; a name
-- is "@" and the name). Only bought credits (never this month's free ones or bonus ones), from p_min to what's left of
-- p_day_max today (UTC), at most p_day_count gifts a day (gift links count too); never to itself; never from or to a banned
-- wallet. → {"ok": true, "paid" (the sender's bought credits now), "to_label"} or {"ok": false, "why": "bad" | "no_name" |
-- "self" | "banned" | "to_banned" | "too_many" | "day_cap" (with "left") | "short" (with "paid") | "taken"}
create or replace function public.inf_send(p_id text, p_from text, p_from_label text, p_to text, p_to_name text, p_to_label text,
  p_credits integer, p_note text, p_min integer, p_day_max integer, p_day_count integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_to text := p_to;
  v_label text := p_to_label;
  v_n integer;
  v_sum integer;
  v_paid integer;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_from is null or char_length(p_from) not between 16 and 64
     or p_from_label is null or char_length(p_from_label) not between 3 and 40 or p_min is null or p_day_max is null
     or p_day_count is null or p_day_count < 1 or p_credits is null or p_credits < greatest(1, p_min)
     or p_credits > least(p_day_max, 1000000) or (p_note is not null and char_length(p_note) not between 1 and 80)
     or (p_to is null) = (p_to_name is null) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  if p_to_name is not null then
    if p_to_name !~ '^[a-z0-9_]{3,32}$' then return json_build_object('ok', false, 'why', 'bad'); end if;
    select wallet_code into v_to from agi1_inf_names where name = p_to_name;
    if not found then return json_build_object('ok', false, 'why', 'no_name'); end if;
    v_label := '@' || p_to_name;
  elsif char_length(p_to) not between 16 and 64 or v_label is null or char_length(v_label) not between 3 and 40 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  if v_to = p_from then return json_build_object('ok', false, 'why', 'self'); end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = p_from and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = v_to and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'to_banned');
  end if;
  -- one sender's gifts one at a time (its day's count and credits), and both wallets' credits locked in one order (two wallets
  -- giving to each other at once never wait on each other)
  perform pg_advisory_xact_lock(hashtext('agi1-inf-gifts:' || p_from));
  select count(*), coalesce(sum(credits), 0) into v_n, v_sum from agi1_credit_gifts
  where from_code = p_from and created_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc';
  if v_n >= p_day_count then return json_build_object('ok', false, 'why', 'too_many'); end if;
  if v_sum + p_credits > p_day_max then return json_build_object('ok', false, 'why', 'day_cap', 'left', greatest(0, p_day_max - v_sum)); end if;
  insert into agi1_credits (wallet_code) values (p_from), (v_to) on conflict (wallet_code) do nothing;
  perform 1 from agi1_credits where wallet_code in (p_from, v_to) order by wallet_code for update;
  select paid into v_paid from agi1_credits where wallet_code = p_from;
  if v_paid < p_credits then return json_build_object('ok', false, 'why', 'short', 'paid', v_paid); end if;
  begin
    insert into agi1_credit_gifts (id, from_code, from_label, to_code, to_label, credits, note, status)
    values (p_id, p_from, p_from_label, v_to, v_label, p_credits, p_note, 'sent');
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  update agi1_credits set paid = paid - p_credits, updated_at = now() where wallet_code = p_from;
  update agi1_credits set paid = least(paid + p_credits, 100000000), updated_at = now() where wallet_code = v_to;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other)
  values (p_from, 'send', p_credits, p_credits, p_id, v_label), (v_to, 'receive', p_credits, p_credits, p_id, p_from_label);
  return json_build_object('ok', true, 'paid', v_paid - p_credits, 'to_label', v_label);
end;
$$;

-- A gift link: p_credits of p_from's bought credits held until someone claims it once (p_token: its secret, the link's part
-- after "#gift="), p_from takes it back, or p_days days pass (then they go back to p_from). The same limits as a gift (they
-- count together), and at most p_open_max links open at once. → {"ok": true, "paid", "expires"} or {"ok": false, "why":
-- "bad" | "banned" | "too_many" | "too_many_links" | "day_cap" (with "left") | "short" (with "paid") | "taken"}
create or replace function public.inf_gift_link(p_id text, p_token text, p_from text, p_from_label text, p_credits integer,
  p_note text, p_min integer, p_day_max integer, p_day_count integer, p_open_max integer, p_days integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_n integer;
  v_sum integer;
  v_paid integer;
  v_until timestamptz;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' or p_token = p_id
     or p_from is null or char_length(p_from) not between 16 and 64 or p_from_label is null or char_length(p_from_label) not between 3 and 40
     or p_min is null or p_day_max is null or p_day_count is null or p_day_count < 1 or p_open_max is null or p_open_max < 1
     or p_days is null or p_days not between 1 and 90 or p_credits is null or p_credits < greatest(1, p_min)
     or p_credits > least(p_day_max, 1000000) or (p_note is not null and char_length(p_note) not between 1 and 80) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = p_from and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-gifts:' || p_from));
  select count(*), coalesce(sum(credits), 0) into v_n, v_sum from agi1_credit_gifts
  where from_code = p_from and created_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc';
  if v_n >= p_day_count then return json_build_object('ok', false, 'why', 'too_many'); end if;
  if v_sum + p_credits > p_day_max then return json_build_object('ok', false, 'why', 'day_cap', 'left', greatest(0, p_day_max - v_sum)); end if;
  if (select count(*) from agi1_credit_gifts where from_code = p_from and status = 'open') >= p_open_max then
    return json_build_object('ok', false, 'why', 'too_many_links');
  end if;
  insert into agi1_credits (wallet_code) values (p_from) on conflict (wallet_code) do nothing;
  select paid into v_paid from agi1_credits where wallet_code = p_from for update;
  if v_paid < p_credits then return json_build_object('ok', false, 'why', 'short', 'paid', v_paid); end if;
  v_until := now() + make_interval(days => p_days);
  begin
    insert into agi1_credit_gifts (id, token, from_code, from_label, credits, note, status, expires_at)
    values (p_id, p_token, p_from, p_from_label, p_credits, p_note, 'open', v_until);
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'taken');
  end;
  update agi1_credits set paid = paid - p_credits, updated_at = now() where wallet_code = p_from;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other) values (p_from, 'hold', p_credits, p_credits, p_id, 'a gift link');
  return json_build_object('ok', true, 'paid', v_paid - p_credits, 'expires', v_until);
end;
$$;

-- A gift link as anyone with it sees it: its credits, who it's from (as its sender shows), its note, and whether it can still
-- be claimed. → {"credits", "from", "note", "status" ("open" | "claimed" | "canceled" | "expired"), "expires"} or null
create or replace function public.inf_gift_peek(p_token text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('credits', g.credits, 'from', g.from_label, 'note', g.note,
    'status', case when g.status = 'open' and g.expires_at <= now() then 'expired' else g.status end, 'expires', g.expires_at)
  from agi1_credit_gifts g where p_token ~ '^[A-Za-z0-9_-]{22}$' and g.token = p_token;
$$;

-- A gift link claimed by p_wallet (p_label: how its sender sees who claimed it): once; never by its own sender (who takes it
-- back instead), never by a banned wallet, never while its sender is banned. One past its days goes back to its sender now.
-- → {"ok": true, "credits", "from", "paid" (the claimer's bought credits now)} or {"ok": false, "why": "gone" | "claimed"
-- (with "mine") | "canceled" | "expired" | "own" | "banned" | "held" | "bad"}
create or replace function public.inf_gift_claim(p_token text, p_wallet text, p_label text)
returns json
language plpgsql
set search_path = public
as $$
declare
  g agi1_credit_gifts%rowtype;
  v_paid integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_label is null or char_length(p_label) not between 3 and 40 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into g from agi1_credit_gifts where token = p_token for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if g.status = 'claimed' then return json_build_object('ok', false, 'why', 'claimed', 'mine', g.to_code = p_wallet); end if;
  if g.status in ('canceled', 'expired') then return json_build_object('ok', false, 'why', g.status); end if;
  if g.expires_at <= now() then
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other)
    values (g.from_code, 'unhold', g.credits, g.credits, g.id, 'a gift link') on conflict (kind, ref) do nothing;
    if found then
      update agi1_credits set paid = least(paid + g.credits, 100000000), updated_at = now() where wallet_code = g.from_code;
    end if;
    update agi1_credit_gifts set status = 'expired', done_at = now() where id = g.id;
    return json_build_object('ok', false, 'why', 'expired');
  end if;
  if g.from_code = p_wallet then return json_build_object('ok', false, 'why', 'own'); end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
  -- a link whose sender was banned waits (a ban for selling credits must stop its links too); lifted, it works again
  if exists (select 1 from agi1_inf_bans where wallet_code = g.from_code and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'held');
  end if;
  insert into agi1_credits (wallet_code) values (p_wallet) on conflict (wallet_code) do nothing;
  update agi1_credits set paid = least(paid + g.credits, 100000000), updated_at = now() where wallet_code = p_wallet returning paid into v_paid;
  update agi1_credit_gifts set status = 'claimed', to_code = p_wallet, to_label = p_label, seen = true, done_at = now() where id = g.id;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other) values (p_wallet, 'receive', g.credits, g.credits, g.id, g.from_label);
  return json_build_object('ok', true, 'credits', g.credits, 'from', g.from_label, 'paid', v_paid);
end;
$$;

-- Its sender takes a gift link back while nobody has claimed it (one past its days too: its credits come back either way).
-- → {"ok": true, "paid", "status" ("canceled" | "expired")} or {"ok": false, "why": "gone" | "state" (with "status") | "bad"}
create or replace function public.inf_gift_cancel(p_id text, p_from text)
returns json
language plpgsql
set search_path = public
as $$
declare
  g agi1_credit_gifts%rowtype;
  v_paid integer;
  v_status text;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_from is null or char_length(p_from) not between 16 and 64 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into g from agi1_credit_gifts where id = p_id for update;
  if not found or g.from_code <> p_from or g.token is null then return json_build_object('ok', false, 'why', 'gone'); end if;
  if g.status <> 'open' then return json_build_object('ok', false, 'why', 'state', 'status', g.status); end if;
  v_status := case when g.expires_at <= now() then 'expired' else 'canceled' end;
  insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other)
  values (p_from, 'unhold', g.credits, g.credits, g.id, 'a gift link') on conflict (kind, ref) do nothing;
  if found then
    update agi1_credits set paid = least(paid + g.credits, 100000000), updated_at = now() where wallet_code = p_from returning paid into v_paid;
  else
    select paid into v_paid from agi1_credits where wallet_code = p_from;
  end if;
  update agi1_credit_gifts set status = v_status, done_at = now() where id = g.id;
  return json_build_object('ok', true, 'paid', v_paid, 'status', v_status);
end;
$$;

-- A wallet's gifts (the newest 40 it gave or got; its own open gift links with their secret, to copy them again) and its
-- invite rewards (the newest 20); the gifts it got are seen from now on. → {"gifts": […], "rewards": […]}
create or replace function public.inf_gifts_mine(p_wallet text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_out json;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 then
    return json_build_object('gifts', '[]'::json, 'rewards', '[]'::json);
  end if;
  select json_build_object(
    'gifts', coalesce((select json_agg(x order by x.created_at desc) from (
      select g.id, case when g.from_code = p_wallet then 'out' else 'in' end as dir, g.credits,
        case when g.from_code = p_wallet then g.to_label else g.from_label end as other, g.note,
        case when g.status = 'open' and g.expires_at <= now() then 'expired' else g.status end as status,
        g.token is not null as link, case when g.from_code = p_wallet and g.status = 'open' and g.expires_at > now() then g.token end as token,
        g.from_code = p_wallet or g.seen as seen, g.created_at, g.expires_at, g.done_at
      from agi1_credit_gifts g where g.from_code = p_wallet or g.to_code = p_wallet
      order by g.created_at desc limit 40) x), '[]'::json),
    'rewards', coalesce((select json_agg(y order by y.at desc) from (
      select l.kind, l.amount, l.at from agi1_credit_log l where l.wallet_code = p_wallet and l.kind in ('ref', 'welcome')
      order by l.at desc limit 20) y), '[]'::json))
  into v_out;
  update agi1_credit_gifts set seen = true where to_code = p_wallet and not seen;
  return v_out;
end;
$$;

-- A wallet's invite code (p_new: one our server made, kept the first time; null back when another wallet has it: try another)
-- and how its invites went. → {"code", "friends" (wallets that joined with it), "buyers" (of them, the ones that bought
-- credits), "earned_month" (its rewards this month), "earned" (in all)}
create or replace function public.inf_ref_code(p_wallet text, p_new text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_new is null or p_new !~ '^[a-hj-km-np-z2-9]{8}$' then
    return json_build_object('code', null);
  end if;
  select code into v_code from agi1_inf_refs where wallet_code = p_wallet;
  if not found then
    begin
      insert into agi1_inf_refs (wallet_code, code) values (p_wallet, p_new);
      v_code := p_new;
    exception when unique_violation then
      select code into v_code from agi1_inf_refs where wallet_code = p_wallet;          -- (made at the same moment: that one)
      if not found then return json_build_object('code', null); end if;                -- (another wallet's code: another one)
    end;
  end if;
  return json_build_object('code', v_code,
    'friends', (select count(*) from agi1_inf_invited where by_code = p_wallet),
    'buyers', (select count(*) from agi1_inf_invited v where v.by_code = p_wallet
      and exists (select 1 from agi1_credit_log l where l.wallet_code = v.wallet_code and l.kind = 'topup')),
    'earned_month', coalesce((select earned from agi1_inf_ref_months where wallet_code = p_wallet and month = studio_this_month()), 0),
    'earned', coalesce((select sum(earned) from agi1_inf_invited where by_code = p_wallet), 0));
end;
$$;

-- A wallet joins through an invite code: once; only a wallet that never bought credits; never its own code, never through
-- the wallet it invited; never a banned wallet, never a banned wallet's code. → {"ok": true} or {"ok": false, "why": "none"
-- | "self" | "already" | "bought" | "loop" | "banned" | "bad"}
create or replace function public.inf_ref_bind(p_wallet text, p_code text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_by text;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_code is null or p_code !~ '^[a-hj-km-np-z2-9]{8}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select wallet_code into v_by from agi1_inf_refs where code = p_code;
  if not found or exists (select 1 from agi1_inf_bans where wallet_code = v_by and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'none');
  end if;
  if v_by = p_wallet then return json_build_object('ok', false, 'why', 'self'); end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
  if exists (select 1 from agi1_inf_invited where wallet_code = p_wallet) then return json_build_object('ok', false, 'why', 'already'); end if;
  if exists (select 1 from agi1_credit_log where wallet_code = p_wallet and kind = 'topup') then
    return json_build_object('ok', false, 'why', 'bought');
  end if;
  if exists (select 1 from agi1_inf_invited where wallet_code = v_by and by_code = p_wallet) then
    return json_build_object('ok', false, 'why', 'loop');
  end if;
  insert into agi1_inf_invited (wallet_code, by_code) values (p_wallet, v_by) on conflict (wallet_code) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'already'); end if;
  return json_build_object('ok', true);
end;
$$;

-- Invites' rewards for the top-ups of wallets that joined through one, each top-up once (p_wallet: one friend's, right after
-- its top-up; null: everyone's not counted yet, the clock's catch-up, at most p_limit). The friend's welcome credits
-- (p_welcome, once, with a top-up of p_welcome_min cents or more); its inviter's reward, p_percent of the top-up in credits,
-- at most p_per_friend from that friend and p_month_cap a month (UTC). Both are bonus credits. A banned wallet gets nothing (the
-- top-up still counts as done). → {"settled", "reward" (in all), "welcome" (in all)}
create or replace function public.inf_ref_settle(p_wallet text, p_percent integer, p_per_friend integer, p_month_cap integer,
  p_welcome integer, p_welcome_min integer, p_limit integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  t record;
  v agi1_inf_invited%rowtype;
  m date := studio_this_month();
  w integer;
  r integer;
  v_got integer;
  n integer := 0;
  all_r integer := 0;
  all_w integer := 0;
begin
  if p_percent is null or p_percent not between 0 and 100 or p_per_friend is null or p_per_friend < 0 or p_month_cap is null
     or p_month_cap < 0 or p_welcome is null or p_welcome < 0 or p_welcome_min is null or p_welcome_min < 0 or p_limit is null
     or p_limit < 1 or (p_wallet is not null and char_length(p_wallet) not between 16 and 64) then
    return json_build_object('settled', 0, 'reward', 0, 'welcome', 0);
  end if;
  for t in
    select l.wallet_code, l.ref, l.amount from agi1_credit_log l join agi1_inf_invited i on i.wallet_code = l.wallet_code
    where l.kind = 'topup' and l.at >= i.at - interval '1 minute' and l.at > now() - interval '30 days'
      and (p_wallet is null or l.wallet_code = p_wallet)
      and not exists (select 1 from agi1_inf_ref_paid p where p.tx_ref = l.ref)
    order by l.at limit least(p_limit, 500)
  loop
    insert into agi1_inf_ref_paid (tx_ref, friend_code) values (t.ref, t.wallet_code) on conflict (tx_ref) do nothing;
    if not found then continue; end if;
    select * into v from agi1_inf_invited where wallet_code = t.wallet_code for update;
    w := 0;
    r := 0;
    -- the friend's welcome credits: once, with a big enough top-up
    if not v.welcomed and p_welcome > 0 and t.amount >= p_welcome_min
       and not exists (select 1 from agi1_inf_bans where wallet_code = t.wallet_code and lifted_at is null) then
      w := p_welcome;
      update agi1_inf_invited set welcomed = true where wallet_code = t.wallet_code;
      update agi1_credits set bonus = least(bonus + w, 100000000), updated_at = now() where wallet_code = t.wallet_code;
      insert into agi1_credit_log (wallet_code, kind, amount, bonus_part, ref) values (t.wallet_code, 'welcome', w, w, 'w:' || t.wallet_code)
        on conflict (kind, ref) do nothing;
    end if;
    -- its inviter's reward, within what's left from this friend and this month
    if p_percent > 0 and not exists (select 1 from agi1_inf_bans where wallet_code = v.by_code and lifted_at is null) then
      r := least((t.amount::bigint * p_percent / 100)::integer, greatest(0, p_per_friend - v.earned));
      if r > 0 then
        insert into agi1_inf_ref_months (wallet_code, month) values (v.by_code, m) on conflict (wallet_code, month) do nothing;
        select earned into v_got from agi1_inf_ref_months where wallet_code = v.by_code and month = m for update;
        r := least(r, greatest(0, p_month_cap - v_got));
      end if;
      if r > 0 then
        insert into agi1_credits (wallet_code) values (v.by_code) on conflict (wallet_code) do nothing;
        update agi1_credits set bonus = least(bonus + r, 100000000), updated_at = now() where wallet_code = v.by_code;
        update agi1_inf_invited set earned = earned + r where wallet_code = t.wallet_code;
        update agi1_inf_ref_months set earned = earned + r where wallet_code = v.by_code and month = m;
        insert into agi1_credit_log (wallet_code, kind, amount, bonus_part, ref) values (v.by_code, 'ref', r, r, t.ref)
          on conflict (kind, ref) do nothing;
      end if;
    end if;
    update agi1_inf_ref_paid set reward = r, welcome = w where tx_ref = t.ref;
    n := n + 1;
    all_r := all_r + r;
    all_w := all_w + w;
  end loop;
  return json_build_object('settled', n, 'reward', all_r, 'welcome', all_w);
end;
$$;

-- ---------- uploads (a picture or a photo, a clip; a selfie before round 2) ----------
-- A new upload, before its file comes (p_per_day: uploads one wallet may start a day). Since round 2 never a selfie ('face':
-- "Use my face" is gone; a photo of a real person is a 'picture', uploaded with its uploader's consent). Since round 4's phase
-- 4 also a reference picture ('ref': a thing, a place, a pet, food or a style for a photo, a meme or a video).
-- → {"ok": true} or {"ok": false, "why": "too_many" | "bad" | "taken"}
create or replace function public.inf_upload_open(p_id text, p_wallet text, p_kind text, p_per_day integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_kind is null or p_kind not in ('picture', 'clip', 'ref') or p_per_day is null or p_per_day < 1 then
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
-- → {"ok": true, "paid", "free", "bonus"} or {"ok": false, "why": "short" | "source" | "too_many" | "no_slot" | "busy_day" | "taken" | "bad"}
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
  -- (round 4, phase 2) a banned wallet makes nothing
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
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
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus');
end;
$$;

-- An influencer as our server needs it (the page gets only some of it), with the looks or full body being made for it now
-- (since round 4 with when it started, for its progress bar) and its maker's clank.trade username, if they showed one
create or replace function public.inf_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select row_to_json(x) from (
    select i.id, i.wallet_code, i.name, i.mode, i.style, i.settings, i.words, i.source, i.status, i.first_job, i.looks_job, i.pick,
      i.body_job, i.body_tries, i.error, i.public, i.hidden, i.level, i.created_at, i.updated_at, i.ready_at, i.real, i.boost_until,
      i.banned,
      (select json_build_object('id', j.id, 'kind', j.kind, 'status', j.status, 'saving', j.saving, 'req', j.req is not null,
           'created', j.created_at)
         from agi1_inf_jobs j where j.inf_id = i.id and j.kind in ('looks', 'body') and j.status in ('paid', 'making')
         order by j.created_at desc limit 1) as job,
      (select n.name from agi1_inf_names n where n.wallet_code = i.wallet_code) as maker
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
-- → {"ok": true, "paid", "free", "bonus"} or {"ok": false, "why": "gone" | "not_yours" | "state" | "short" | "busy_day" | "taken" | "bad"}
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
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
  begin
    if not inf_day_take(p_day_cap) then return json_build_object('ok', false, 'why', 'busy_day'); end if;
    s := inf_spend(p_wallet, p_cost, p_job);
    if (s ->> 'ok')::boolean is not true then raise exception using errcode = 'P0001', message = coalesce(s ->> 'why', 'busy'); end if;
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, cost) values (p_job, p_id, p_wallet, 'looks', p_cost);
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  update agi1_inf set status = 'looks', error = null, updated_at = now() where id = p_id;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus');
end;
$$;

-- Something made for a ready influencer, by its own wallet: a photo in a scene, a trend video (a kept trend move, or its
-- owner's own clip that passed the AI check), or a scene video; from its full body, or (p_image) one of its done photos.
-- p_per_wallet: jobs one wallet may have being made at once · p_day_cap: AI jobs a day for the whole site.
-- (Round 4) a photo may be an X banner (p_shape 'banner'); a video or trend video never starts from one ("banner").
-- → {"ok": true, "paid", "free", "bonus"} or {"ok": false, "why": "gone" | "not_yours" | "not_ready" | "trend" | "clip" | "image" |
--   "banner" | "too_many" | "short" | "busy_day" | "taken" | "bad"}
-- (Round 4, phase 4 added p_model … p_caption, with defaults: the older version is dropped first, so the web API never has
-- two to choose from; an older page's call still works: Classic, Standard for 5 s.)
drop function if exists public.inf_make(text, text, text, text, text, text, boolean, text, text, text, integer, integer, integer);
create or replace function public.inf_make(p_job text, p_inf text, p_wallet text, p_kind text, p_scene text, p_shape text, p_sound boolean,
  p_trend text, p_clip text, p_image text, p_cost integer, p_per_wallet integer, p_day_cap integer, p_model text default null,
  p_quality text default null, p_seconds integer default null, p_refs text[] default null, p_parts integer default 1,
  p_meme text default null, p_caption text default null)
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
       or p_shape not in ('tall', 'wide', 'square', 'banner') or p_trend is not null or p_clip is not null))
     or (p_kind <> 'photo' and p_shape = 'banner')
     or (p_kind = 'trend' and ((p_trend is null) = (p_clip is null) or p_scene is not null))
     or (p_kind = 'photo' and p_image is not null)
     -- (round 4, phase 4) the model menu: a photo's model is Classic or Crisp, a video's Standard, Pro, Anime or Long; a long
     -- video has 2 to 4 parts (a trend is as before: none of it); a meme is a Classic photo with its words; references 1 to 4
     or (p_model is not null and not ((p_kind = 'photo' and p_model in ('classic', 'crisp'))
       or (p_kind = 'video' and p_model in ('standard', 'pro', 'anime', 'long'))))
     or (p_quality is not null and p_quality not in ('std', 'hd', 'ultra', '480p', '720p'))
     or (p_seconds is not null and (p_kind <> 'video' or p_seconds not between 3 and 60))
     or p_parts is null or p_parts not between 1 and 4 or (p_parts > 1 and p_model is distinct from 'long')
     or (p_model = 'long' and p_parts < 2)
     or ((p_meme is null) <> (p_caption is null)) or (p_meme is not null and (p_kind <> 'photo' or p_meme !~ '^[a-z]{2,12}$'
       or char_length(p_caption) not between 1 and 130 or p_model = 'crisp' or p_shape = 'banner'))
     or (p_refs is not null and (p_kind = 'trend' or cardinality(p_refs) not between 1 and 4)) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || p_wallet));
  select * into i from agi1_inf where id = p_inf for update;
  if not found or i.status = 'deleted' or i.hidden then return json_build_object('ok', false, 'why', 'gone'); end if;
  if i.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
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
  if p_image is not null and exists (select 1 from agi1_inf_jobs where id = p_image and shape = 'banner') then
    return json_build_object('ok', false, 'why', 'banner');
  end if;
  -- (round 4, phase 4) its references: this wallet's own, looked at and passed, from the last day, each once
  if p_refs is not null and (select count(distinct id) from agi1_inf_uploads where id = any(p_refs) and wallet_code = p_wallet
      and kind = 'ref' and status = 'ok' and created_at > now() - interval '1 day') <> cardinality(p_refs) then
    return json_build_object('ok', false, 'why', 'refs');
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
    insert into agi1_inf_jobs (id, inf_id, wallet_code, kind, scene, shape, sound, trend, clip, image, cost, model, quality, seconds,
      refs, parts, meme, caption)
    values (p_job, p_inf, p_wallet, p_kind, p_scene, p_shape, coalesce(p_sound, false) and p_kind = 'video', p_trend, p_clip, p_image, p_cost,
      p_model, p_quality, p_seconds, p_refs, p_parts, p_meme, p_caption);
  exception
    when unique_violation then return json_build_object('ok', false, 'why', 'taken');
    when sqlstate 'P0001' then
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus');
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
      j.model, j.quality, j.seconds, j.refs, j.parts, j.part, j.meme, j.caption,
      i.name as inf_name, i.mode as inf_mode, i.style as inf_style, i.settings as inf_settings, i.words as inf_words,
      i.source as inf_source, i.status as inf_status, i.looks_job as inf_looks_job, i.pick as inf_pick, i.body_job as inf_body_job,
      i.hidden as inf_hidden, i.public as inf_public, i.real as inf_real, i.banned as inf_banned,
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

-- (Round 4, phase 4) a long video's part is made and kept: on to the next one (p_part: the next, = part + 1; once it's parts,
-- they're joined), sent to the AI service afresh. → true once
create or replace function public.inf_job_part(p_id text, p_part integer)
returns boolean
language sql
set search_path = public
as $$
  update agi1_inf_jobs set part = p_part::smallint, req = null, status_url = null, result_url = null, saving = false, tries = 0,
    lease_until = null, updated_at = now()
  where id = p_id and status = 'making' and parts > 1 and p_part = part + 1 and p_part <= parts
  returning true;
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
      'model', model, 'quality', quality, 'seconds', seconds, 'refs', coalesce(cardinality(refs), 0), 'parts', parts, 'part', part,
      'meme', meme, 'caption', caption,
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
-- spotlight of the week (the newest one the owner approved, in the last two weeks). (Round 4) each with its maker's
-- clank.trade username when they showed one ("by @name"), and no X banners among the fresh photos (an X header, not a post).
create or replace function public.inf_explore(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'influencers', (select coalesce(json_agg(json_build_object('id', a.id, 'name', a.name, 'style', a.style, 'looks_job', a.looks_job,
        'pick', a.pick, 'body_job', a.body_job, 'ready_at', a.ready_at, 'maker', n.name) order by a.ready_at desc), '[]'::json)
      from (select * from agi1_inf where status = 'ready' and public and not hidden and mode <> 'face' and not real and not banned
        order by ready_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) a
      left join agi1_inf_names n on n.wallet_code = a.wallet_code),
    'fresh', (select coalesce(json_agg(json_build_object('id', j.id, 'kind', j.kind, 'shape', j.shape, 'trend', j.trend, 'poster', j.poster,
        'files', j.files, 'likes', j.likes, 'inf_id', j.inf_id, 'inf_name', j.inf_name, 'looks_job', j.inf_looks_job, 'pick', j.inf_pick,
        'done_at', j.done_at, 'maker', n.name, 'model', j.model, 'quality', j.quality, 'seconds', j.seconds, 'sound', j.sound, 'meme', j.meme,
        'caption', j.caption) order by j.done_at desc), '[]'::json)
      from (select x.id, x.kind, x.shape, x.trend, x.poster, x.files, x.likes, x.inf_id, x.done_at, x.model, x.quality, x.seconds, x.sound,
          x.meme, x.caption, i.name as inf_name,
          i.looks_job as inf_looks_job, i.pick as inf_pick, i.wallet_code as inf_wallet
        from agi1_inf_jobs x join agi1_inf i on i.id = x.inf_id
        where x.status = 'done' and x.kind in ('photo', 'trend', 'video') and not x.hidden and i.status = 'ready' and i.public and not i.hidden
          and i.mode <> 'face' and not i.real and not i.banned and x.shape is distinct from 'banner'
        order by x.done_at desc limit least(greatest(coalesce(p_limit, 24), 1), 60)) j
      left join agi1_inf_names n on n.wallet_code = j.inf_wallet),
    'trends', (select coalesce(json_agg(json_build_object('id', t.id, 'job', t.job, 'poster', j.poster, 'bytes', j.bytes) order by t.sort, t.id), '[]'::json)
      from agi1_inf_trends t join agi1_inf_jobs j on j.id = t.job where t.status = 'kept' and j.status = 'done'),
    'boosted', (select coalesce(json_agg(json_build_object('id', b.id, 'name', b.name, 'style', b.style, 'looks_job', b.looks_job, 'pick', b.pick,
        'body_job', b.body_job, 'until', b.boost_until, 'maker', n.name) order by b.boost_until desc), '[]'::json)
      from (select * from agi1_inf where boost_until > now() and status = 'ready' and public and not hidden and mode <> 'face' and not real
          and not banned
        order by boost_until desc limit 12) b
      left join agi1_inf_names n on n.wallet_code = b.wallet_code),
    'spotlight', (select row_to_json(s) from (
        select w.week, w.status, w.holder_likes, w.likes, w.prize, j.id, j.kind, j.shape, j.poster, j.files, j.inf_id,
          i.name as inf_name, i.looks_job, i.pick, (select n.name from agi1_inf_names n where n.wallet_code = i.wallet_code) as maker
        from agi1_inf_weeks w join agi1_inf_jobs j on j.id = w.job_id join agi1_inf i on i.id = j.inf_id
        where w.status in ('approved', 'claimed', 'sending', 'sent') and w.week >= (date_trunc('week', now() at time zone 'utc')::date - 14)
          and j.status = 'done' and not j.hidden and i.status = 'ready' and not i.hidden and not i.banned
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
-- in burns.sql (a studio order keeps it). → {"ok": true, "free", "paid", "free_credits", "bonus"} or {"ok": false, "why": "gone" |
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
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
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
      return case when sqlerrm = 'short' then json_build_object('ok', false, 'why', 'short', 'paid', s -> 'paid', 'free', s -> 'free', 'bonus', s -> 'bonus')
        else json_build_object('ok', false, 'why', case when sqlerrm in ('taken', 'bad') then sqlerrm else 'busy' end) end;
  end;
  return json_build_object('ok', true, 'free', is_free, 'paid', s -> 'paid', 'free_credits', s -> 'free', 'bonus', s -> 'bonus');
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
-- free (a burned one: `credit`), or a quote that went nowhere (`expired`); (round 4) when its making started, for its progress
create or replace function public.inf_3d_list(p_inf text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'status', status, 'step', step, 'error', error, 'moves', moves,
      'glb_bytes', glb_bytes, 'created_at', created_at, 'done_at', done_at, 'kind', kind, 'agi', agi, 'paid', paid,
      'started_at', coalesce(started_at, paid_at),
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
  if exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'banned');
  end if;
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
      'name', i.name, 'mode', i.mode, 'real', i.real, 'hidden', i.hidden or coalesce(j.hidden, false),
      'banned', i.banned) order by r.at desc), '[]'::json)
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
  where kind in ('trend', 'video') and status = 'done' and not hidden and not marked and mark_tries < 3 and parts = 1
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
  if not found or i.status <> 'ready' or i.hidden or i.banned then return json_build_object('ok', false, 'why', 'gone'); end if;
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
      and i.status = 'ready' and i.public and not i.hidden and i.mode <> 'face' and not i.real and not i.banned
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
    'boosted', (select count(*) from agi1_inf where boost_until > now() and status = 'ready' and public and not hidden and mode <> 'face' and not real
      and not banned));
$$;

-- ---------- round 4 (2026-10-11): clank.trade usernames, captions ----------
-- The clank.trade username a wallet showed, and when our server last checked it. → {"name", "checked_at"} or null
create or replace function public.inf_name_get(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('name', name, 'checked_at', checked_at) from agi1_inf_names where wallet_code = p_wallet;
$$;

-- A wallet's clank.trade username, once our server read its clank.trade profile and that profile's wallet was this one (a
-- name another wallet showed before is taken over: the profile's wallet is this one now); checked again, the same name keeps
-- it and says when. p_name null: it shows none any more. → {"ok": true} or {"ok": false, "why": "bad"}
create or replace function public.inf_name_set(p_wallet text, p_name text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 then return json_build_object('ok', false, 'why', 'bad'); end if;
  if p_name is null then
    delete from agi1_inf_names where wallet_code = p_wallet;
    return json_build_object('ok', true);
  end if;
  if p_name !~ '^[a-z0-9_]{3,32}$' then return json_build_object('ok', false, 'why', 'bad'); end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-name:' || p_name));
  delete from agi1_inf_names where name = p_name and wallet_code <> p_wallet;
  insert into agi1_inf_names (wallet_code, name, checked_at) values (p_wallet, p_name, now())
  on conflict (wallet_code) do update set name = excluded.name, checked_at = now();
  return json_build_object('ok', true);
end;
$$;

-- One more caption written by AI for this wallet today (p_per_day a wallet, p_site_cap the whole site, UTC days), counted
-- before the AI is asked. → {"ok": true, "left"} or {"ok": false, "why": "too_many" | "busy_day" | "bad"}
create or replace function public.inf_caption_take(p_wallet text, p_per_day integer, p_site_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  mine integer;
  site integer;
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 or p_per_day is null or p_per_day < 1
     or p_site_cap is null or p_site_cap < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_inf_caption_days (wallet_code, day) values (p_wallet, today) on conflict do nothing;
  select n into mine from agi1_inf_caption_days where wallet_code = p_wallet and day = today for update;
  if mine >= p_per_day then return json_build_object('ok', false, 'why', 'too_many'); end if;
  insert into agi1_inf_days (day) values (today) on conflict (day) do nothing;
  select captions into site from agi1_inf_days where day = today for update;
  if site >= p_site_cap then return json_build_object('ok', false, 'why', 'busy_day'); end if;
  update agi1_inf_days set captions = captions + 1 where day = today;
  update agi1_inf_caption_days set n = n + 1 where wallet_code = p_wallet and day = today;
  return json_build_object('ok', true, 'left', p_per_day - mine - 1);
end;
$$;

-- ---------- round 4, phase 2 (2026-10-11): the team, bans, support tickets, the AI helper, alerts, the owner's numbers ----------
-- A wallet as AGI Studio sees it now: its role in the team ('mod' | 'support', or null), its nickname there, and whether it's
-- banned. → {"role", "nick", "banned"}
create or replace function public.inf_who(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'role', (select role from agi1_inf_staff where wallet_code = p_wallet),
    'nick', (select nick from agi1_inf_staff where wallet_code = p_wallet),
    'banned', exists (select 1 from agi1_inf_bans where wallet_code = p_wallet and lifted_at is null));
$$;

-- The team, for the owner's page: each member's code (to change or remove them), role, nickname, short address, since when,
-- and how many Telegram chats get their alerts
create or replace function public.inf_staff_list()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('code', s.wallet_code, 'role', s.role, 'nick', s.nick, 'short', s.short,
      'added_at', s.added_at, 'alerts', (select count(*) from agi1_inf_alerts a where a.who = s.wallet_code)) order by s.added_at), '[]'::json)
  from agi1_inf_staff s;
$$;

-- The owner adds a member (or changes their role or nickname: nicknames are each their own, whatever the case), or removes
-- them (p_role null: their alert chats go too). At most p_max members.
-- → {"ok": true} or {"ok": false, "why": "too_many" | "nick_taken" | "gone" | "bad"}
create or replace function public.inf_staff_set(p_wallet text, p_role text, p_nick text, p_short text, p_max integer)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_wallet is null or char_length(p_wallet) not between 16 and 64 then return json_build_object('ok', false, 'why', 'bad'); end if;
  if p_role is null then
    delete from agi1_inf_staff where wallet_code = p_wallet;
    if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
    delete from agi1_inf_alerts where who = p_wallet;
    return json_build_object('ok', true);
  end if;
  if p_role not in ('mod', 'support') or p_nick is null or char_length(p_nick) not between 2 and 24
     or p_short is null or p_short !~ '^0x[0-9a-f]{4}…[0-9a-f]{4}$' or p_max is null or p_max < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-staff'));
  if exists (select 1 from agi1_inf_staff where lower(nick) = lower(p_nick) and wallet_code <> p_wallet) then
    return json_build_object('ok', false, 'why', 'nick_taken');
  end if;
  if not exists (select 1 from agi1_inf_staff where wallet_code = p_wallet) and (select count(*) from agi1_inf_staff) >= p_max then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_staff (wallet_code, role, nick, short) values (p_wallet, p_role, p_nick, p_short)
  on conflict (wallet_code) do update set role = excluded.role, nick = excluded.nick, short = excluded.short;
  return json_build_object('ok', true);
end;
$$;

-- A mod (or the owner) bans the maker of an influencer: its wallet makes nothing in AGI Studio any more (inf_start, inf_make,
-- inf_reroll, inf_3d and inf_3d_burn say "banned"), and its influencers are shown to nobody but itself (Explore, their pages,
-- likes, the spotlight) until the ban is lifted. Never the owner's wallet (p_protect: its code) or a team member's.
-- → {"ok": true, "id", "infs"} or {"ok": false, "why": "gone" | "already" | "protected" | "bad"}
create or replace function public.inf_ban(p_id text, p_inf text, p_reason text, p_note text, p_by text, p_protect text)
returns json
language plpgsql
set search_path = public
as $$
declare
  w text;
  n integer;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_inf is null or p_inf !~ '^[A-Za-z0-9_-]{22}$' or p_reason is null
     or p_reason not in ('real_person', 'minor', 'sexual', 'hate', 'violence', 'copyright', 'spam', 'scam', 'other')
     or char_length(coalesce(p_note, '')) > 200 or p_by is null or char_length(p_by) not between 2 and 24 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select wallet_code into w from agi1_inf where id = p_inf;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if w = p_protect or exists (select 1 from agi1_inf_staff where wallet_code = w) then
    return json_build_object('ok', false, 'why', 'protected');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-wallet:' || w));
  if exists (select 1 from agi1_inf_bans where wallet_code = w and lifted_at is null) then
    return json_build_object('ok', false, 'why', 'already');
  end if;
  insert into agi1_inf_bans (id, wallet_code, inf_id, reason, note, by_nick) values (p_id, w, p_inf, p_reason, nullif(p_note, ''), p_by);
  update agi1_inf set banned = true, updated_at = now() where wallet_code = w;
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'id', p_id, 'infs', n);
exception when unique_violation then
  return json_build_object('ok', false, 'why', 'already');
end;
$$;

-- A mod (or the owner) lifts a ban: its wallet's influencers are shown again, as they were.
-- → {"ok": true} or {"ok": false, "why": "gone" | "done" | "bad"}
create or replace function public.inf_unban(p_id text, p_by text)
returns json
language plpgsql
set search_path = public
as $$
declare
  b agi1_inf_bans%rowtype;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_by is null or char_length(p_by) not between 2 and 24 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into b from agi1_inf_bans where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if b.lifted_at is not null then return json_build_object('ok', false, 'why', 'done'); end if;
  update agi1_inf_bans set lifted_at = now(), lifted_by = p_by where id = p_id;
  update agi1_inf set banned = false, updated_at = now() where wallet_code = b.wallet_code;
  return json_build_object('ok', true);
end;
$$;

-- The bans, for the team: the live ones first, then the ones lifted in the last 30 days (newest first), each with the
-- influencer it was for, how many influencers its wallet has, and its support tickets not closed
create or replace function public.inf_bans(p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', b.id, 'inf_id', b.inf_id, 'name', i.name, 'reason', b.reason, 'note', b.note,
      'by', b.by_nick, 'at', b.at, 'lifted_at', b.lifted_at, 'lifted_by', b.lifted_by,
      'infs', (select count(*) from agi1_inf x where x.wallet_code = b.wallet_code and x.status <> 'deleted'),
      'tickets', (select count(*) from agi1_inf_tickets t where t.wallet_code = b.wallet_code and t.status <> 'closed'))
    order by (b.lifted_at is null) desc, coalesce(b.lifted_at, b.at) desc), '[]'::json)
  from (select * from agi1_inf_bans where lifted_at is null or lifted_at > now() - interval '30 days'
    order by (lifted_at is null) desc, coalesce(lifted_at, at) desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) b
  left join agi1_inf i on i.id = b.inf_id;
$$;

-- A wallet opens a support ticket (its topic and first message): at most p_open_cap not closed at once, p_per_day of its own
-- messages a day (opening one is one), p_site_cap tickets a day for the whole site (UTC). A banned wallet may too (to ask why).
-- → {"ok": true, "id"} or {"ok": false, "why": "too_many_open" | "too_many" | "busy_day" | "taken" | "bad"}
create or replace function public.inf_ticket_open(p_id text, p_wallet text, p_topic text, p_body text, p_open_cap integer,
  p_per_day integer, p_site_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  site integer;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_topic is null or p_topic not in ('payment', 'making', 'account', 'bug', 'other') or p_body is null
     or char_length(p_body) not between 1 and 1000 or p_open_cap is null or p_open_cap < 1 or p_per_day is null or p_per_day < 1
     or p_site_cap is null or p_site_cap < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-tickets:' || p_wallet));
  if (select count(*) from agi1_inf_tickets where wallet_code = p_wallet and status <> 'closed') >= p_open_cap then
    return json_build_object('ok', false, 'why', 'too_many_open');
  end if;
  if (select count(*) from agi1_inf_ticket_msgs m join agi1_inf_tickets t on t.id = m.ticket_id
      where t.wallet_code = p_wallet and not m.from_staff and m.at > now() - interval '1 day') >= p_per_day then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_days (day) values (today) on conflict (day) do nothing;
  select tickets into site from agi1_inf_days where day = today for update;
  if site >= p_site_cap then return json_build_object('ok', false, 'why', 'busy_day'); end if;
  insert into agi1_inf_tickets (id, wallet_code, topic) values (p_id, p_wallet, p_topic) on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'taken'); end if;
  insert into agi1_inf_ticket_msgs (ticket_id, from_staff, body) values (p_id, false, p_body);
  update agi1_inf_days set tickets = tickets + 1 where day = today;
  return json_build_object('ok', true, 'id', p_id);
end;
$$;

-- A message in a ticket: from its own wallet (p_wallet; one of its p_per_day a day; a ticket the team answered waits for the
-- team again), or from the team (p_by: a nickname; the person sees it as AGI Studio support's). Never in a closed one.
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_yours" | "closed" | "too_many" | "bad"}
create or replace function public.inf_ticket_say(p_ticket text, p_wallet text, p_by text, p_body text, p_per_day integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  t agi1_inf_tickets%rowtype;
begin
  if p_ticket is null or p_ticket !~ '^[A-Za-z0-9_-]{22}$' or (p_wallet is null) = (p_by is null)
     or (p_wallet is not null and char_length(p_wallet) not between 16 and 64) or (p_by is not null and char_length(p_by) not between 2 and 24)
     or p_body is null or char_length(p_body) not between 1 and 1000 or p_per_day is null or p_per_day < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into t from agi1_inf_tickets where id = p_ticket for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if p_wallet is not null and t.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if t.status = 'closed' then return json_build_object('ok', false, 'why', 'closed'); end if;
  if p_wallet is not null then
    perform pg_advisory_xact_lock(hashtext('agi1-inf-tickets:' || p_wallet));
    if (select count(*) from agi1_inf_ticket_msgs m join agi1_inf_tickets x on x.id = m.ticket_id
        where x.wallet_code = p_wallet and not m.from_staff and m.at > now() - interval '1 day') >= p_per_day then
      return json_build_object('ok', false, 'why', 'too_many');
    end if;
    insert into agi1_inf_ticket_msgs (ticket_id, from_staff, body) values (p_ticket, false, p_body);
    update agi1_inf_tickets set status = 'open', updated_at = now() where id = p_ticket;
  else
    insert into agi1_inf_ticket_msgs (ticket_id, from_staff, by_nick, body) values (p_ticket, true, p_by, p_body);
    update agi1_inf_tickets set status = 'answered', user_seen = false, updated_at = now() where id = p_ticket;
  end if;
  return json_build_object('ok', true);
end;
$$;

-- A ticket closed: by its own wallet (p_wallet), or by the team (p_wallet null).
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_yours" | "closed" | "bad"}
create or replace function public.inf_ticket_close(p_ticket text, p_wallet text)
returns json
language plpgsql
set search_path = public
as $$
declare
  t agi1_inf_tickets%rowtype;
begin
  if p_ticket is null or p_ticket !~ '^[A-Za-z0-9_-]{22}$' or (p_wallet is not null and char_length(p_wallet) not between 16 and 64) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into t from agi1_inf_tickets where id = p_ticket for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if p_wallet is not null and t.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'not_yours'); end if;
  if t.status = 'closed' then return json_build_object('ok', false, 'why', 'closed'); end if;
  update agi1_inf_tickets set status = 'closed', closed_at = now(), updated_at = now(),
    user_seen = case when p_wallet is not null then true else user_seen end where id = p_ticket;
  return json_build_object('ok', true);
end;
$$;

-- A wallet's own tickets, the newest first (20): their topic, state, whether the team wrote something it hasn't read, its
-- first words
create or replace function public.inf_tickets_mine(p_wallet text)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', t.id, 'topic', t.topic, 'status', t.status, 'unread', not t.user_seen,
      'created_at', t.created_at, 'updated_at', t.updated_at,
      'first', (select left(m.body, 120) from agi1_inf_ticket_msgs m where m.ticket_id = t.id order by m.id limit 1))
    order by t.updated_at desc), '[]'::json)
  from (select * from agi1_inf_tickets where wallet_code = p_wallet order by updated_at desc limit 20) t;
$$;

-- One ticket with its messages, the oldest first (our server decides who may see it). p_seen: the code of its own wallet,
-- reading it (the team's reply it hadn't read is read now), or null. → {id, wallet_code, topic, status, user_seen, created_at,
-- updated_at, closed_at, msgs: [{from_staff, by, body, at}]} or null
create or replace function public.inf_ticket_get(p_ticket text, p_seen text)
returns json
language plpgsql
set search_path = public
as $$
declare
  t agi1_inf_tickets%rowtype;
begin
  if p_ticket is null or p_ticket !~ '^[A-Za-z0-9_-]{22}$' then return null; end if;
  select * into t from agi1_inf_tickets where id = p_ticket;
  if not found then return null; end if;
  if p_seen is not null and p_seen = t.wallet_code and not t.user_seen then
    update agi1_inf_tickets set user_seen = true where id = p_ticket;
    t.user_seen := true;
  end if;
  return json_build_object('id', t.id, 'wallet_code', t.wallet_code, 'topic', t.topic, 'status', t.status, 'user_seen', t.user_seen,
    'created_at', t.created_at, 'updated_at', t.updated_at, 'closed_at', t.closed_at,
    'msgs', (select coalesce(json_agg(json_build_object('from_staff', m.from_staff, 'by', m.by_nick, 'body', m.body, 'at', m.at)
        order by m.id), '[]'::json) from agi1_inf_ticket_msgs m where m.ticket_id = t.id));
end;
$$;

-- The tickets for the team: p_status 'open' (waiting for the team), 'answered', 'closed', or null (open and answered). The
-- ones waiting first, the longest waiting first; then the newest. Each with its topic, its first words, how many messages,
-- and whether its wallet is banned.
create or replace function public.inf_tickets_staff(p_status text, p_limit integer)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', t.id, 'topic', t.topic, 'status', t.status, 'created_at', t.created_at,
      'updated_at', t.updated_at, 'msgs', (select count(*) from agi1_inf_ticket_msgs m where m.ticket_id = t.id),
      'first', (select left(m.body, 160) from agi1_inf_ticket_msgs m where m.ticket_id = t.id order by m.id limit 1),
      'banned', exists (select 1 from agi1_inf_bans b where b.wallet_code = t.wallet_code and b.lifted_at is null))
    order by (t.status = 'open') desc, case when t.status = 'open' then t.updated_at end asc, t.updated_at desc), '[]'::json)
  from (select * from agi1_inf_tickets
    where case when p_status is null then status in ('open', 'answered') else status = p_status end
    order by (status = 'open') desc, case when status = 'open' then updated_at end asc, updated_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)) t;
$$;

-- One more answer from the AI helper for this wallet (or signed-out visitor: its daily code) today (p_per_day each, p_site_cap
-- the whole site, UTC days), counted before the AI is asked. → {"ok": true, "left"} or {"ok": false, "why": "too_many" |
-- "busy_day" | "bad"}
create or replace function public.inf_help_take(p_who text, p_per_day integer, p_site_cap integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  mine integer;
  site integer;
begin
  if p_who is null or char_length(p_who) not between 16 and 64 or p_per_day is null or p_per_day < 1
     or p_site_cap is null or p_site_cap < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_inf_help_days (who, day) values (p_who, today) on conflict do nothing;
  select n into mine from agi1_inf_help_days where who = p_who and day = today for update;
  if mine >= p_per_day then return json_build_object('ok', false, 'why', 'too_many'); end if;
  insert into agi1_inf_days (day) values (today) on conflict (day) do nothing;
  select helps into site from agi1_inf_days where day = today for update;
  if site >= p_site_cap then return json_build_object('ok', false, 'why', 'busy_day'); end if;
  update agi1_inf_days set helps = helps + 1 where day = today;
  update agi1_inf_help_days set n = n + 1 where who = p_who and day = today;
  return json_build_object('ok', true, 'left', p_per_day - mine - 1);
end;
$$;

-- A Telegram chat that gets AGI Studio's alerts, from her bot (the owner's, or a team member's: p_who their wallet code,
-- while they're in the team), at most 5 chats each. → {"ok": true} or {"ok": false, "why": "not_staff" | "too_many" | "bad"}
create or replace function public.inf_alert_add(p_chat bigint, p_who text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_chat is null or p_chat <= 0 or p_who is null or (p_who <> 'owner' and char_length(p_who) not between 16 and 64) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  if p_who <> 'owner' and not exists (select 1 from agi1_inf_staff where wallet_code = p_who) then
    return json_build_object('ok', false, 'why', 'not_staff');
  end if;
  perform pg_advisory_xact_lock(hashtext('agi1-inf-alerts:' || p_who));
  if not exists (select 1 from agi1_inf_alerts where chat_id = p_chat and who = p_who)
     and (select count(*) from agi1_inf_alerts where who = p_who) >= 5 then
    return json_build_object('ok', false, 'why', 'too_many');
  end if;
  insert into agi1_inf_alerts (chat_id, who) values (p_chat, p_who)
  on conflict (chat_id) do update set who = excluded.who, added_at = now();
  return json_build_object('ok', true);
end;
$$;

-- A chat's alerts turned off (/stop in her bot, or a chat that blocked her). → true, or null (it got none)
create or replace function public.inf_alert_off(p_chat bigint)
returns boolean
language sql
set search_path = public
as $$
  delete from agi1_inf_alerts where chat_id = p_chat returning true;
$$;

-- The chats that get alerts, and who each is: the owner (everything), a mod (tickets and reports) or support (tickets)
create or replace function public.inf_alert_chats()
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('chat', a.chat_id, 'who', case when a.who = 'owner' then 'owner' else s.role end)
    order by a.added_at), '[]'::json)
  from agi1_inf_alerts a left join agi1_inf_staff s on s.wallet_code = a.who
  where a.who = 'owner' or s.role is not null;
$$;

-- The owner's settings (p_key 'thresholds': when a balance is low enough for an alert). → its value, or null
create or replace function public.inf_admin_get(p_key text)
returns json
language sql
stable
set search_path = public
as $$
  select value::json from agi1_inf_admin where key = p_key;
$$;
create or replace function public.inf_admin_set(p_key text, p_value jsonb)
returns boolean
language sql
set search_path = public
as $$
  insert into agi1_inf_admin (key, value, at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, at = now() returning true;
$$;

-- Something the clock does at most every p_secs (an alert, the balances' check), claimed once whatever runs at the same time.
-- → {"ok": true, "prev"} (prev: the last claim's time, or null the first time) or {"ok": false}
create or replace function public.inf_admin_claim(p_key text, p_secs integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  last timestamptz;
begin
  if p_key is null or p_key !~ '^[a-z][a-z0-9_:-]{1,40}$' or p_secs is null or p_secs < 1 then return json_build_object('ok', false); end if;
  insert into agi1_inf_admin (key, at) values (p_key, now()) on conflict (key) do nothing;
  if found then return json_build_object('ok', true, 'prev', null); end if;
  select at into last from agi1_inf_admin where key = p_key for update;
  if last > now() - make_interval(secs => p_secs) then return json_build_object('ok', false); end if;
  update agi1_inf_admin set at = now() where key = p_key;
  return json_build_object('ok', true, 'prev', last);
end;
$$;

-- The owner's numbers: influencers (ready, made today and this week, being made), what was made today and this week by
-- kind (an X banner on its own: for the AI's cost), what failed today, credits bought (cents), spent and given (free this
-- month, gifts this month; since round 4's phase 3 gifts between people this week, gift links waiting, invites' rewards and
-- the wallets invited this month), wallets that made something this week, likes this week, 3D models this month, support
-- tickets, reports, live bans and the AI helper's answers today
create or replace function public.inf_admin_stats()
returns json
language sql
stable
set search_path = public
as $$
  with b as (
    select ((now() at time zone 'utc')::date)::timestamp at time zone 'utc' as today,
      (date_trunc('month', now() at time zone 'utc'))::timestamp at time zone 'utc' as month
  )
  select json_build_object(
    'infs', json_build_object(
      'ready', (select count(*) from agi1_inf where status = 'ready'),
      'today', (select count(*) from agi1_inf, b where status <> 'deleted' and created_at >= b.today),
      'week', (select count(*) from agi1_inf where status <> 'deleted' and created_at > now() - interval '7 days'),
      'making', (select count(*) from agi1_inf where status in ('looks', 'pick', 'body'))),
    'jobs_today', (select coalesce(json_object_agg(k, n), '{}'::json) from (
      select case when shape = 'banner' then 'banner' else kind end as k, count(*) as n from agi1_inf_jobs, b
      where created_at >= b.today and status <> 'failed' group by 1) x),
    'jobs_week', (select coalesce(json_object_agg(k, n), '{}'::json) from (
      select case when shape = 'banner' then 'banner' else kind end as k, count(*) as n from agi1_inf_jobs
      where created_at > now() - interval '7 days' and status <> 'failed' group by 1) x),
    'failed_today', (select count(*) from agi1_inf_jobs, b where status = 'failed' and updated_at >= b.today),
    'making', (select count(*) from agi1_inf_jobs where status in ('paid', 'making')),
    'credits', json_build_object(
      'bought_today', (select coalesce(sum(amount), 0) from agi1_credit_log, b where kind = 'topup' and at >= b.today),
      'bought_week', (select coalesce(sum(amount), 0) from agi1_credit_log where kind = 'topup' and at > now() - interval '7 days'),
      'bought_month', (select coalesce(sum(amount), 0) from agi1_credit_log, b where kind = 'topup' and at >= b.month),
      'spent_week', (select coalesce(sum(case when kind = 'spend' then amount else -amount end), 0) from agi1_credit_log
        where kind in ('spend', 'refund') and at > now() - interval '7 days'),
      'free_month', (select coalesce(sum(free_given), 0) from agi1_credit_months where month = (date_trunc('month', now() at time zone 'utc'))::date),
      'gifts_month', (select coalesce(sum(amount), 0) from agi1_credit_log, b where kind = 'gift' and at >= b.month),
      -- (round 4, phase 3) bought credits passed on as gifts this week (sent, or a link claimed), gift links waiting, invites'
      -- rewards and welcome credits this month, and the wallets that joined through an invite this month
      'gifted_week', (select coalesce(sum(amount), 0) from agi1_credit_log where kind = 'receive' and at > now() - interval '7 days'),
      'links_open', (select count(*) from agi1_credit_gifts where status = 'open' and expires_at > now()),
      'rewards_month', (select coalesce(sum(amount), 0) from agi1_credit_log, b where kind in ('ref', 'welcome') and at >= b.month),
      'invited_month', (select count(*) from agi1_inf_invited, b where at >= b.month)),
    'wallets_week', (select count(distinct wallet_code) from agi1_inf_jobs where created_at > now() - interval '7 days' and wallet_code is not null),
    'likes_week', (select count(*) from agi1_inf_likes where at > now() - interval '7 days'),
    'models_month', (select coalesce(sum(made), 0) from agi1_studio_months where month = studio_this_month()),
    'tickets', json_build_object(
      'open', (select count(*) from agi1_inf_tickets where status = 'open'),
      'answered', (select count(*) from agi1_inf_tickets where status = 'answered')),
    'reports', (select count(*) from (select distinct inf_id, coalesce(job_id, '') from agi1_inf_reports) r),
    'bans', (select count(*) from agi1_inf_bans where lifted_at is null),
    'helps_today', (select coalesce(sum(helps), 0) from agi1_inf_days where day = (now() at time zone 'utc')::date));
$$;

-- What's new for the team since p_since (the clock's alert, every few minutes): tickets that started waiting for the team
-- since (opened, or the person wrote again), new reports; and how many wait in all. → {"tickets", "reports", "waiting",
-- "open_reports"}
create or replace function public.inf_mod_news(p_since timestamptz)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'tickets', (select count(distinct m.ticket_id) from agi1_inf_ticket_msgs m join agi1_inf_tickets t on t.id = m.ticket_id
      where not m.from_staff and m.at > coalesce(p_since, now() - interval '10 minutes') and t.status = 'open'),
    'reports', (select count(*) from agi1_inf_reports where at > coalesce(p_since, now() - interval '10 minutes')),
    'waiting', (select count(*) from agi1_inf_tickets where status = 'open'),
    'open_reports', (select count(*) from (select distinct inf_id, coalesce(job_id, '') from agi1_inf_reports) r));
$$;

-- ---------- tidy-up (the studio's clock, every half hour) ----------
-- Uploads go after 2 days (a selfie or a picture as soon as its influencer is made, or can't be: our server deletes their
-- files), influencers that couldn't be made after 30 days, deleted ones after a week (their files went at once), jobs that
-- failed after 60 days, reports after 90 days; leases left behind are given back; (round 4, phase 3) gift links past their
-- days give their credits back to their senders. → {"uploads": [{id, kind}], "infs": [ids] (their folders deleted again by
-- our server, in case deleting them at once failed), "jobs", "reports", "gifts" (gift links given back)}
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
  g record;
  v_gifts integer := 0;
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
  -- (round 4) a wallet's captions a day go after 2 days
  delete from agi1_inf_caption_days where day < (now() at time zone 'utc')::date - 2;
  -- (round 4, phase 2) the AI helper's answers a day after 2 days; a ticket the team answered and nobody wrote in for 14 days
  -- is closed; closed tickets go after 90 days (with their messages); lifted bans after 180 days
  delete from agi1_inf_help_days where day < (now() at time zone 'utc')::date - 2;
  update agi1_inf_tickets set status = 'closed', closed_at = now() where status = 'answered' and updated_at < now() - interval '14 days';
  delete from agi1_inf_tickets where status = 'closed' and coalesce(closed_at, updated_at) < now() - interval '90 days';
  delete from agi1_inf_bans where lifted_at < now() - interval '180 days';
  -- (round 4, phase 3) gift links past their days: their credits back to their senders, each once (its 'unhold' in the log
  -- first); a gift that's done goes after a year (the credits' log keeps each one); each friend's counted top-up after 60 days
  -- (only a top-up from the last 30 days is ever counted); what an inviter earned a month after 400 days
  for g in
    select id, from_code, credits from agi1_credit_gifts where status = 'open' and expires_at <= now()
    order by expires_at limit 500 for update skip locked
  loop
    insert into agi1_credit_log (wallet_code, kind, amount, paid_part, ref, other)
    values (g.from_code, 'unhold', g.credits, g.credits, g.id, 'a gift link') on conflict (kind, ref) do nothing;
    if found then
      update agi1_credits set paid = least(paid + g.credits, 100000000), updated_at = now() where wallet_code = g.from_code;
    end if;
    update agi1_credit_gifts set status = 'expired', done_at = now() where id = g.id;
    v_gifts := v_gifts + 1;
  end loop;
  delete from agi1_credit_gifts where status <> 'open' and coalesce(done_at, created_at) < now() - interval '365 days';
  delete from agi1_inf_ref_paid p where p.at < now() - interval '60 days'
    and not exists (select 1 from agi1_credit_log l where l.kind = 'topup' and l.ref = p.tx_ref and l.at > now() - interval '31 days');
  delete from agi1_inf_ref_months where month < (now() at time zone 'utc')::date - 400;
  return json_build_object('uploads', ups, 'infs', infs, 'jobs', jobs, 'reports', reports, 'gifts', v_gifts);
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
    'inf_make(text, text, text, text, text, text, boolean, text, text, text, integer, integer, integer, text, text, integer, text[], integer, text, text)',
    'inf_job_get(text)',
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
    'inf_gift(text, integer, text)',
    -- round 4
    'inf_name_get(text)', 'inf_name_set(text, text)', 'inf_caption_take(text, integer, integer)',
    -- round 4, phase 2
    'inf_who(text)', 'inf_staff_list()', 'inf_staff_set(text, text, text, text, integer)',
    'inf_ban(text, text, text, text, text, text)', 'inf_unban(text, text)', 'inf_bans(integer)',
    'inf_ticket_open(text, text, text, text, integer, integer, integer)', 'inf_ticket_say(text, text, text, text, integer)',
    'inf_ticket_close(text, text)', 'inf_tickets_mine(text)', 'inf_ticket_get(text, text)', 'inf_tickets_staff(text, integer)',
    'inf_help_take(text, integer, integer)', 'inf_alert_add(bigint, text)', 'inf_alert_off(bigint)', 'inf_alert_chats()',
    'inf_admin_get(text)', 'inf_admin_set(text, jsonb)', 'inf_admin_claim(text, integer)', 'inf_admin_stats()',
    'inf_mod_news(timestamptz)',
    -- round 4, phase 3
    'inf_send(text, text, text, text, text, text, integer, text, integer, integer, integer)',
    'inf_gift_link(text, text, text, text, integer, text, integer, integer, integer, integer, integer)',
    'inf_gift_peek(text)', 'inf_gift_claim(text, text, text)', 'inf_gift_cancel(text, text)', 'inf_gifts_mine(text)',
    'inf_ref_code(text, text)', 'inf_ref_bind(text, text)',
    'inf_ref_settle(text, integer, integer, integer, integer, integer, integer)',
    -- round 4, phase 4
    'inf_job_part(text, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: influencers_ready = 1 (its 94 functions, each exactly once: since round 2 an older inf_start or inf_upload_set left
-- behind would count twice, since round 4's phase 4 an older inf_make; round 2's new columns; round 3's gifts in the credits' log; round 4's banners, names and
-- captions; round 4's phase 2: the team, bans (and the 5 functions that refuse a banned wallet), tickets, the AI helper's
-- counts, alerts and the owner's numbers; round 4's phase 3: bonus credits, gifts and invites, and every kind they log;
-- round 4's phase 4: the model menu's columns, reference uploads and long videos' parts; and studio.sql's new parts it builds on)
select
  (case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('inf_credits', 'inf_spend', 'inf_refund',
    'inf_topup', 'inf_free', 'inf_upload_open', 'inf_upload_get', 'inf_upload_set', 'inf_day_take', 'inf_start', 'inf_get', 'inf_pick',
    'inf_reroll', 'inf_make', 'inf_job_get', 'inf_job_lease', 'inf_job_step', 'inf_job_wait', 'inf_job_done', 'inf_job_fail',
    'inf_job_due', 'inf_poster', 'inf_jobs', 'inf_mine', 'inf_explore', 'inf_public', 'inf_delete', 'inf_hide', 'inf_job_hide',
    'inf_3d', 'inf_3d_back', 'inf_3d_list', 'trend_make', 'trend_set', 'trend_list', 'inf_report', 'inf_reports',
    'inf_report_clear', 'inf_tidy',
    'inf_3d_burn', 'inf_example_make', 'inf_examples', 'inf_mark_take', 'inf_mark_done', 'inf_like', 'inf_liked', 'inf_week_top',
    'inf_week_pick', 'inf_week_set', 'inf_weeks', 'inf_week_claim', 'inf_week_sending', 'inf_week_sent', 'inf_burn_quote',
    'inf_burn_pay', 'inf_burn_get', 'inf_burns_open', 'inf_slots', 'inf_stats', 'inf_gift',
    'inf_name_get', 'inf_name_set', 'inf_caption_take',
    'inf_who', 'inf_staff_list', 'inf_staff_set', 'inf_ban', 'inf_unban', 'inf_bans', 'inf_ticket_open', 'inf_ticket_say',
    'inf_ticket_close', 'inf_tickets_mine', 'inf_ticket_get', 'inf_tickets_staff', 'inf_help_take', 'inf_alert_add', 'inf_alert_off',
    'inf_alert_chats', 'inf_admin_get', 'inf_admin_set', 'inf_admin_claim', 'inf_admin_stats', 'inf_mod_news',
    'inf_send', 'inf_gift_link', 'inf_gift_peek', 'inf_gift_claim', 'inf_gift_cancel', 'inf_gifts_mine', 'inf_ref_code',
    'inf_ref_bind', 'inf_ref_settle', 'inf_job_part')) = 94 then 1 else 0 end)
    * (case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'agi1_inf_jobs'
        and column_name in ('model', 'quality', 'seconds', 'refs', 'parts', 'part', 'meme', 'caption')) = 8
      and exists (select 1 from pg_constraint where conrelid = 'public.agi1_inf_uploads'::regclass
        and conname = 'agi1_inf_uploads_kind_check' and pg_get_constraintdef(oid) like '%''ref''%')
      and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'inf_mark_take' and prosrc like '%parts = 1%')
      then 1 else 0 end)
    * (case when (select count(*) from information_schema.columns where table_schema = 'public'
        and ((table_name = 'agi1_credits' and column_name = 'bonus')
          or (table_name = 'agi1_credit_log' and column_name in ('bonus_part', 'other')))) = 3
      and to_regclass('public.agi1_credit_gifts') is not null and to_regclass('public.agi1_inf_refs') is not null
      and to_regclass('public.agi1_inf_invited') is not null and to_regclass('public.agi1_inf_ref_months') is not null
      and to_regclass('public.agi1_inf_ref_paid') is not null
      and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'inf_spend' and prosrc like '%bonus_part%')
      and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'inf_tidy' and prosrc like '%agi1_credit_gifts%')
      then 1 else 0 end)
    * (case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('inf_start', 'inf_make', 'inf_reroll', 'inf_3d', 'inf_3d_burn') and prosrc like '%agi1_inf_bans%') = 5
      and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_inf' and column_name = 'banned')
      and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'agi1_inf_days'
        and column_name in ('helps', 'tickets')) = 2
      and to_regclass('public.agi1_inf_staff') is not null and to_regclass('public.agi1_inf_bans') is not null
      and to_regclass('public.agi1_inf_tickets') is not null and to_regclass('public.agi1_inf_ticket_msgs') is not null
      and to_regclass('public.agi1_inf_help_days') is not null and to_regclass('public.agi1_inf_alerts') is not null
      and to_regclass('public.agi1_inf_admin') is not null then 1 else 0 end)
    * (case when exists (select 1 from pg_constraint where conrelid = 'public.agi1_inf_jobs'::regclass
        and conname = 'agi1_inf_jobs_shape_check' and pg_get_constraintdef(oid) like '%banner%')
      and to_regclass('public.agi1_inf_names') is not null and to_regclass('public.agi1_inf_caption_days') is not null
      and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_inf_days'
        and column_name = 'captions') then 1 else 0 end)
    * (case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agi1_studio_orders'
        and column_name = 'image_path') then 1 else 0 end)
    * (case when (select count(*) from information_schema.columns where table_schema = 'public'
        and ((table_name = 'agi1_inf' and column_name in ('real', 'boost_until'))
          or (table_name = 'agi1_inf_uploads' and column_name = 'real')
          or (table_name = 'agi1_inf_jobs' and column_name in ('example', 'marked', 'mark_tries', 'mark_at', 'likes')))) = 8 then 1 else 0 end)
    * (case when exists (select 1 from pg_constraint where conrelid = 'public.agi1_credit_log'::regclass
        and conname = 'agi1_credit_log_kind_check' and pg_get_constraintdef(oid) like '%''gift''%'
        and pg_get_constraintdef(oid) like '%''welcome''%' and pg_get_constraintdef(oid) like '%''unhold''%') then 1 else 0 end)
    as influencers_ready;
