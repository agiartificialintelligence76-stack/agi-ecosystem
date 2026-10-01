-- AGI-1: "Launch with AGI-1" (2026-10-01, the owner's idea: people launch a coin on clank.trade from her Telegram bot,
-- with their own wallet). Run this once in the Supabase project that SUPABASE_URL points to, any time: SQL Editor → New
-- query → paste all of it → Run. It ends by showing launch_functions_found = 12. **Until it's run (and PINATA_JWT is set
-- in Vercel), her /launch says launching isn't open yet**, and the launch page can't get a coin ready.
-- It only ADDS four new tables and twelve functions (all named agi1_launch… / launch_…). It doesn't touch any table the
-- original site uses, so it's safe in the database both sites share. Running it again changes nothing that's saved.
--
-- How it works: in her bot, a photo captioned "/launch Name | TICKER | one line" becomes a draft here (once her checks
-- pass), and she sends its private link (agi1.app/launch/<id>, the id is 22 random characters). On that page the person
-- connects their own wallet (it needs 10,000+ $AGI held or burned: the chat's Crush level), our server puts the picture on
-- IPFS (Pinata) once, and builds the launch for their wallet to approve. The launch itself happens on clank.trade's own
-- contracts, from their wallet: nothing here can launch, sign or move anything.
-- Their network fee, paid back (the owner's choice, 2026-10-01): once the launch is read on the chain, the owner's small gas
-- wallet (LAUNCH_GAS_KEY in Vercel) sends that fee back to the creator, once per coin, at most one a day per wallet and
-- LAUNCH_GAS_DAILY a day for the whole site. Never twice: a payback is claimed here before anything is sent, marked
-- "sending" right before it goes, and only given back when nothing went out.
--
-- What's kept:
--   agi1_launch_drafts   each draft: its id, the coin's name, ticker and line, the Telegram id of its picture (only our
--                        bot can read it), the picture's IPFS id once uploaded (and Pinata's id for it, to delete it if the
--                        coin is never launched), the scrambled code of the wallet that got it ready (the first one: the
--                        link then only works for that wallet), once launched the coin's address and its launch
--                        transaction (both public on the chain, where they show which wallet made it), when it ends (2
--                        hours for getting it ready), and its fee paid back (how much, how it went, the transaction, when).
--                        Drafts are deleted after 7 days (launch_tidy, from the keep-alive job).
--   agi1_launch_chats    per Telegram chat and day: drafts made (under a daily code of the chat, never its number)
--   agi1_launch_wallets  per wallet and day: pictures uploaded and fees paid back (under the wallet's scrambled code, never
--                        its address)
--   agi1_launch_days     per day: drafts, pictures uploaded, launches and the ETH paid back for the whole site (the daily
--                        caps), 30 days kept
-- Only the server (the secret key) can use them.

create table if not exists public.agi1_launch_drafts (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  chat_code   text        not null check (char_length(chat_code) between 16 and 64),
  name        text        not null check (char_length(name) between 1 and 32 and octet_length(name) <= 64),
  symbol      text        not null check (symbol ~ '^[A-Z0-9]{2,10}$'),
  description text        not null default '' check (char_length(description) <= 100 and octet_length(description) <= 300),
  photo       text        not null check (char_length(photo) between 10 and 300),
  cid         text        check (cid is null or cid ~ '^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$'),
  pin_id      text        check (pin_id is null or pin_id ~ '^[A-Za-z0-9_-]{1,100}$'),   -- Pinata's id of the picture we uploaded
  upload_at   timestamptz,                                                             -- an upload counted and under way
  wallet_code text        check (wallet_code is null or char_length(wallet_code) between 16 and 64),
  predicted   text        check (predicted is null or predicted ~ '^0x[0-9a-f]{40}$'),     -- where its coin will be (the dry run)
  token       text        check (token is null or token ~ '^0x[0-9a-f]{40}$'),
  launch_tx   text        check (launch_tx is null or launch_tx ~ '^0x[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  -- its network fee, paid back: how much (wei), how it went (claimed = about to be sent · sending · sent · skipped = a daily
  -- cap, for good), why it was skipped, its transaction, when it last changed
  gas_wei     numeric     check (gas_wei is null or (gas_wei > 0 and gas_wei = trunc(gas_wei))),
  gas_state   text        check (gas_state is null or gas_state in ('claimed', 'sending', 'sent', 'skipped')),
  gas_why     text        check (gas_why is null or gas_why in ('wallet_cap', 'site_cap')),
  gas_tx      text        check (gas_tx is null or gas_tx ~ '^0x[0-9a-f]{64}$'),
  gas_at      timestamptz
);
-- (run over an earlier version of this file: the columns it didn't have yet, and the payback's states)
alter table public.agi1_launch_drafts add column if not exists pin_id text check (pin_id is null or pin_id ~ '^[A-Za-z0-9_-]{1,100}$');
alter table public.agi1_launch_drafts add column if not exists upload_at timestamptz;
alter table public.agi1_launch_drafts add column if not exists predicted text check (predicted is null or predicted ~ '^0x[0-9a-f]{40}$');
alter table public.agi1_launch_drafts add column if not exists launch_tx text check (launch_tx is null or launch_tx ~ '^0x[0-9a-f]{64}$');
alter table public.agi1_launch_drafts add column if not exists gas_why text check (gas_why is null or gas_why in ('wallet_cap', 'site_cap'));
alter table public.agi1_launch_drafts add column if not exists gas_at timestamptz;
update public.agi1_launch_drafts set gas_state = null where gas_state not in ('claimed', 'sending', 'sent', 'skipped');
alter table public.agi1_launch_drafts drop constraint if exists agi1_launch_drafts_gas_state_check;
alter table public.agi1_launch_drafts add constraint agi1_launch_drafts_gas_state_check
  check (gas_state is null or gas_state in ('claimed', 'sending', 'sent', 'skipped'));
-- one coin belongs to one draft (so one launch is paid back once)
create unique index if not exists agi1_launch_drafts_token on public.agi1_launch_drafts (token) where token is not null;

create table if not exists public.agi1_launch_chats (
  chat_code text    primary key check (char_length(chat_code) between 16 and 64),
  day       date    not null default ((now() at time zone 'utc')::date),
  drafts    integer not null default 0 check (drafts >= 0)
);

create table if not exists public.agi1_launch_wallets (
  wallet_code text    not null check (char_length(wallet_code) between 16 and 64),
  day         date    not null,
  uploads     integer not null default 0 check (uploads >= 0),
  refunds     integer not null default 0 check (refunds >= 0),
  primary key (wallet_code, day)
);

create table if not exists public.agi1_launch_days (
  day      date    primary key,
  drafts   integer not null default 0 check (drafts >= 0),
  uploads  integer not null default 0 check (uploads >= 0),
  launches integer not null default 0 check (launches >= 0),
  gas_wei  numeric not null default 0 check (gas_wei >= 0)          -- ETH paid back that day (wei)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_launch_drafts enable row level security;
alter table public.agi1_launch_chats enable row level security;
alter table public.agi1_launch_wallets enable row level security;
alter table public.agi1_launch_days enable row level security;
revoke all on table public.agi1_launch_drafts from anon, authenticated;
revoke all on table public.agi1_launch_chats from anon, authenticated;
revoke all on table public.agi1_launch_wallets from anon, authenticated;
revoke all on table public.agi1_launch_days from anon, authenticated;

-- Every function locks rows in the same order (the day's row, then a wallet's, then the draft), so two of them at once
-- never wait on each other.

-- A new draft, after her checks passed. p_chat: the chat's daily code · p_minutes: how long it can be got ready ·
-- p_per_chat: drafts a chat may make a day · p_site_daily: drafts the whole site may make a day.
-- → {"ok": true, "expires"} or {"ok": false, "why": "chat_cap" | "site_cap" | "bad"}
create or replace function public.launch_draft_put(p_id text, p_chat text, p_name text, p_symbol text, p_desc text, p_photo text,
  p_minutes integer, p_per_chat integer, p_site_daily integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  c agi1_launch_chats%rowtype;
  s agi1_launch_days%rowtype;
  ends timestamptz;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_chat is null or char_length(p_chat) not between 16 and 64
     or p_name is null or char_length(p_name) not between 1 and 32 or octet_length(p_name) > 64
     or p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,10}$'
     or char_length(coalesce(p_desc, '')) > 100 or octet_length(coalesce(p_desc, '')) > 300
     or p_photo is null or char_length(p_photo) not between 10 and 300
     or p_minutes is null or p_minutes not between 1 and 1440 or p_per_chat is null or p_per_chat < 1
     or p_site_daily is null or p_site_daily < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_launch_days (day) values (today) on conflict (day) do nothing;
  select * into s from agi1_launch_days where day = today for update;
  insert into agi1_launch_chats (chat_code, day) values (p_chat, today) on conflict (chat_code) do nothing;
  select * into c from agi1_launch_chats where chat_code = p_chat for update;
  if c.day <> today then
    update agi1_launch_chats set day = today, drafts = 0 where chat_code = p_chat returning * into c;
  end if;
  if c.drafts >= p_per_chat then return json_build_object('ok', false, 'why', 'chat_cap'); end if;
  if s.drafts >= p_site_daily then return json_build_object('ok', false, 'why', 'site_cap'); end if;
  ends := now() + p_minutes * interval '1 minute';
  insert into agi1_launch_drafts (id, chat_code, name, symbol, description, photo, expires_at)
  values (p_id, p_chat, p_name, p_symbol, coalesce(p_desc, ''), p_photo, ends)
  on conflict (id) do nothing;
  if not found then return json_build_object('ok', false, 'why', 'bad'); end if;
  update agi1_launch_chats set drafts = drafts + 1 where chat_code = p_chat;
  update agi1_launch_days set drafts = drafts + 1 where day = today;
  return json_build_object('ok', true, 'expires', ends);
end;
$$;

-- One draft, for the server. → {"id", "name", "symbol", "description", "photo", "cid", "wallet", "predicted", "token", "launch_tx",
-- "expires", "expired", "gas_wei", "gas_state", "gas_why", "gas_tx", "gas_stuck"} or null (no such draft).
-- gas_stuck: "sending" for over 2 minutes without an answer (it may have gone out: never sent again)
create or replace function public.launch_draft_get(p_id text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('id', d.id, 'name', d.name, 'symbol', d.symbol, 'description', d.description, 'photo', d.photo,
    'cid', d.cid, 'wallet', d.wallet_code, 'predicted', d.predicted, 'token', d.token, 'launch_tx', d.launch_tx, 'expires', d.expires_at,
    'expired', d.expires_at <= now(), 'gas_wei', d.gas_wei::text, 'gas_state', d.gas_state, 'gas_why', d.gas_why,
    'gas_tx', d.gas_tx, 'gas_stuck', coalesce(d.gas_state = 'sending' and d.gas_at < now() - interval '2 minutes', false))
  from agi1_launch_drafts d where p_id ~ '^[A-Za-z0-9_-]{22}$' and d.id = p_id;
$$;

-- Getting a draft ready for one wallet (one atomic step): the first wallet that gets it ready keeps it. When its picture
-- isn't on IPFS yet, an upload is counted here first (that wallet's and the site's daily uploads), so many tries at once
-- can't get past the caps; launch_upload_back gives it back when the upload fails. A second try while one is under way
-- (under a minute) waits.
-- → {"ok": true, "upload": true|false, "cid"} or {"ok": false, "why": "gone" | "expired" | "launched" | "other_wallet" |
--   "uploading" | "wallet_cap" | "site_cap" | "bad"}
create or replace function public.launch_prepare(p_id text, p_wallet text, p_per_wallet integer, p_site_daily integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  d agi1_launch_drafts%rowtype;
  s agi1_launch_days%rowtype;
  w agi1_launch_wallets%rowtype;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_per_wallet is null or p_per_wallet < 1 or p_site_daily is null or p_site_daily < 1 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_launch_days (day) values (today) on conflict (day) do nothing;
  select * into s from agi1_launch_days where day = today for update;
  insert into agi1_launch_wallets (wallet_code, day) values (p_wallet, today) on conflict (wallet_code, day) do nothing;
  select * into w from agi1_launch_wallets where wallet_code = p_wallet and day = today for update;
  select * into d from agi1_launch_drafts where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if d.token is not null then return json_build_object('ok', false, 'why', 'launched'); end if;
  if d.wallet_code is not null and d.wallet_code <> p_wallet then return json_build_object('ok', false, 'why', 'other_wallet'); end if;
  if d.expires_at <= now() then return json_build_object('ok', false, 'why', 'expired'); end if;
  if d.cid is not null then
    update agi1_launch_drafts set wallet_code = p_wallet where id = p_id;
    return json_build_object('ok', true, 'upload', false, 'cid', d.cid);
  end if;
  if d.upload_at is not null then
    if d.upload_at > now() - interval '1 minute' then return json_build_object('ok', false, 'why', 'uploading'); end if;
    -- an upload that never finished (its count was kept): this try takes it over, without counting again
    update agi1_launch_drafts set wallet_code = p_wallet, upload_at = now() where id = p_id;
    return json_build_object('ok', true, 'upload', true, 'cid', null);
  end if;
  if w.uploads >= p_per_wallet then return json_build_object('ok', false, 'why', 'wallet_cap'); end if;
  if s.uploads >= p_site_daily then return json_build_object('ok', false, 'why', 'site_cap'); end if;
  update agi1_launch_wallets set uploads = uploads + 1 where wallet_code = p_wallet and day = today;
  update agi1_launch_days set uploads = uploads + 1 where day = today;
  update agi1_launch_drafts set wallet_code = p_wallet, upload_at = now() where id = p_id;
  return json_build_object('ok', true, 'upload', true, 'cid', null);
end;
$$;

-- The upload failed (Telegram or Pinata): its count is given back. → true, or false (no upload under way for that draft)
create or replace function public.launch_upload_back(p_id text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  d agi1_launch_drafts%rowtype;
  up_day date;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' then return false; end if;
  -- (read first, to lock in the usual order)
  select * into d from agi1_launch_drafts where id = p_id;
  if not found or d.cid is not null or d.upload_at is null or d.wallet_code is null then return false; end if;
  up_day := (d.upload_at at time zone 'utc')::date;
  perform 1 from agi1_launch_days where day = up_day for update;
  perform 1 from agi1_launch_wallets where wallet_code = d.wallet_code and day = up_day for update;
  update agi1_launch_drafts set upload_at = null where id = p_id and cid is null and upload_at = d.upload_at;
  if not found then return false; end if;
  update agi1_launch_wallets set uploads = greatest(uploads - 1, 0) where wallet_code = d.wallet_code and day = up_day;
  update agi1_launch_days set uploads = greatest(uploads - 1, 0) where day = up_day;
  return true;
end;
$$;

-- The draft's picture is on IPFS: kept, so it's never uploaded twice (with Pinata's id for it, when we made it, so a coin
-- that's never launched can have its picture deleted). → true, or false (no such draft, already kept, or bad ids)
create or replace function public.launch_set_cid(p_id text, p_cid text, p_pin text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_cid is null or p_cid !~ '^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$'
     or (p_pin is not null and p_pin !~ '^[A-Za-z0-9_-]{1,100}$') then
    return false;
  end if;
  update agi1_launch_drafts set cid = p_cid, pin_id = p_pin, upload_at = null
  where id = p_id and cid is null and token is null and wallet_code is not null;
  return found;
end;
$$;

-- Where its coin will be, from the dry run of its launch (fixed by its creator, details and salt): read back from there,
-- and its picture is never deleted while a coin is there. → true, or false (not this wallet's draft, or launched)
create or replace function public.launch_predicted(p_id text, p_wallet text, p_token text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or p_token is null or p_token !~ '^0x[0-9a-f]{40}$' then return false; end if;
  update agi1_launch_drafts set predicted = p_token where id = p_id and wallet_code = p_wallet and token is null;
  return found;
end;
$$;

-- The coin is live (our server read it on Robinhood Chain: this draft's own launch, by that wallet). Kept once, with its
-- launch transaction; a coin belongs to one draft only.
-- → {"ok": true, "token"} (the coin it was launched as, the first time) or {"ok": false, "why": "gone" | "other_wallet" |
--   "other_draft" | "bad"}
create or replace function public.launch_done(p_id text, p_wallet text, p_token text, p_tx text)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  d agi1_launch_drafts%rowtype;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or p_token is null or p_token !~ '^0x[0-9a-f]{40}$'
     or p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_launch_days (day) values (today) on conflict (day) do nothing;
  perform 1 from agi1_launch_days where day = today for update;
  select * into d from agi1_launch_drafts where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if d.wallet_code is distinct from p_wallet then return json_build_object('ok', false, 'why', 'other_wallet'); end if;
  if d.token is not null then return json_build_object('ok', true, 'token', d.token); end if;
  begin
    update agi1_launch_drafts set token = p_token, launch_tx = p_tx where id = p_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'other_draft');
  end;
  update agi1_launch_days set launches = launches + 1 where day = today;
  return json_build_object('ok', true, 'token', p_token);
end;
$$;

-- Paying a launch's network fee back (one atomic step, before the gas wallet sends anything): once per coin, only once it's
-- launched by that wallet, at most p_per_wallet a day per wallet and p_daily_wei a day for the site. A coin over a cap is
-- skipped for good (checking it again on another day doesn't pay it). A claim that never got to "sending" within 2
-- minutes (its server copy stopped) is given back and taken over.
-- → {"ok": true} or {"ok": false, "why": "gone" | "not_launched" | "other_wallet" | "used" | "wallet_cap" | "site_cap" | "bad"}
--   ("used": "state" claimed | sending | sent | skipped, "tx", "wei", "reason" (why skipped), "stuck" (sending for over 2
--   minutes without an answer: it may have gone out, so it's never sent again))
create or replace function public.launch_gas_claim(p_id text, p_wallet text, p_wei numeric, p_per_wallet integer, p_daily_wei numeric)
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  d agi1_launch_drafts%rowtype;
  s agi1_launch_days%rowtype;
  w agi1_launch_wallets%rowtype;
  old_day date;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_wallet is null or char_length(p_wallet) not between 16 and 64
     or p_wei is null or p_wei <= 0 or p_wei <> trunc(p_wei) or p_wei > 1e20
     or p_per_wallet is null or p_per_wallet < 1 or p_daily_wei is null or p_daily_wei <= 0 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  insert into agi1_launch_days (day) values (today) on conflict (day) do nothing;
  select * into s from agi1_launch_days where day = today for update;
  insert into agi1_launch_wallets (wallet_code, day) values (p_wallet, today) on conflict (wallet_code, day) do nothing;
  select * into w from agi1_launch_wallets where wallet_code = p_wallet and day = today for update;
  select * into d from agi1_launch_drafts where id = p_id for update;
  if not found then return json_build_object('ok', false, 'why', 'gone'); end if;
  if d.token is null then return json_build_object('ok', false, 'why', 'not_launched'); end if;
  if d.wallet_code is distinct from p_wallet then return json_build_object('ok', false, 'why', 'other_wallet'); end if;
  if d.gas_state = 'claimed' and d.gas_at < now() - interval '2 minutes' then
    -- never got to "sending": nothing went out. Its counts are given back (on the day it was claimed), then claimed again.
    old_day := (d.gas_at at time zone 'utc')::date;
    update agi1_launch_wallets set refunds = greatest(refunds - 1, 0) where wallet_code = p_wallet and day = old_day;
    update agi1_launch_days set gas_wei = greatest(gas_wei - d.gas_wei, 0) where day = old_day;
    if old_day = today then
      select * into w from agi1_launch_wallets where wallet_code = p_wallet and day = today;
      select * into s from agi1_launch_days where day = today;
    end if;
    update agi1_launch_drafts set gas_state = null, gas_wei = null, gas_at = null where id = p_id;
    d.gas_state := null;
  end if;
  if d.gas_state is not null then
    return json_build_object('ok', false, 'why', 'used', 'state', d.gas_state, 'tx', d.gas_tx, 'wei', d.gas_wei::text,
      'reason', d.gas_why, 'stuck', coalesce(d.gas_state = 'sending' and d.gas_at < now() - interval '2 minutes', false));
  end if;
  if w.refunds >= p_per_wallet then
    update agi1_launch_drafts set gas_state = 'skipped', gas_why = 'wallet_cap', gas_at = now() where id = p_id;
    return json_build_object('ok', false, 'why', 'wallet_cap');
  end if;
  if s.gas_wei + p_wei > p_daily_wei then
    update agi1_launch_drafts set gas_state = 'skipped', gas_why = 'site_cap', gas_at = now() where id = p_id;
    return json_build_object('ok', false, 'why', 'site_cap');
  end if;
  update agi1_launch_drafts set gas_wei = p_wei, gas_state = 'claimed', gas_why = null, gas_at = now() where id = p_id;
  update agi1_launch_wallets set refunds = refunds + 1 where wallet_code = p_wallet and day = today;
  update agi1_launch_days set gas_wei = gas_wei + p_wei where day = today;
  return json_build_object('ok', true);
end;
$$;

-- Right before the gas wallet's transaction goes out: "sending", with that transaction (signed, not sent yet), so a later
-- check can find it on the chain; again for a retry with the next nonce. From then on it's never given back without a clear
-- answer. → true, or false (not claimed: then nothing is sent)
create or replace function public.launch_gas_sending(p_id text, p_tx text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then return false; end if;
  update agi1_launch_drafts set gas_state = 'sending', gas_tx = p_tx, gas_at = now()
  where id = p_id and (gas_state = 'claimed' or (gas_state = 'sending' and gas_at > now() - interval '1 minute'));
  return found;
end;
$$;

-- How the payback went: sent (p_ok, its transaction: for good), or nothing went out (the chain clearly refused it, or the
-- gas wallet is empty): then the claim is given back, with what it counted toward the caps, so a later check can try
-- again. → true, or false (nothing being sent for that draft)
create or replace function public.launch_gas_sent(p_id text, p_tx text, p_ok boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  d agi1_launch_drafts%rowtype;
  claim_day date;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{22}$' or p_ok is null or (p_ok and p_tx is null)
     or (p_tx is not null and p_tx !~ '^0x[0-9a-f]{64}$') then
    return false;
  end if;
  if p_ok then
    update agi1_launch_drafts set gas_state = 'sent', gas_tx = p_tx, gas_at = now() where id = p_id and gas_state = 'sending';
    return found;
  end if;
  -- (read first, to lock in the usual order: the claim's day, its wallet, then the draft)
  select * into d from agi1_launch_drafts where id = p_id;
  if not found or d.gas_state is distinct from 'sending' then return false; end if;
  claim_day := (d.gas_at at time zone 'utc')::date;
  perform 1 from agi1_launch_days where day = claim_day for update;
  perform 1 from agi1_launch_wallets where wallet_code = d.wallet_code and day = claim_day for update;
  update agi1_launch_drafts set gas_state = null, gas_wei = null, gas_tx = null, gas_at = null
  where id = p_id and gas_state = 'sending' and gas_at = d.gas_at;
  if not found then return false; end if;
  update agi1_launch_wallets set refunds = greatest(refunds - 1, 0) where wallet_code = d.wallet_code and day = claim_day;
  update agi1_launch_days set gas_wei = greatest(gas_wei - d.gas_wei, 0) where day = claim_day;
  return true;
end;
$$;

-- Tidying up (the keep-alive job, 3 times a day): deletes drafts after 7 days and old counts, and → the Pinata ids of
-- pictures we uploaded for coins that were never launched (their link ended over an hour ago), at most 50, unless a
-- still-open draft uses the same picture. A picture a launched coin uses is never deleted, whichever draft uploaded it
-- (Pinata gives the same picture one id); and the server first asks the factory whether a coin is where the draft's own
-- launch would have put it ("predicted": a launch nobody read back), keeping its picture if so. Then it deletes the rest
-- at Pinata and calls launch_unpinned (for both). → {"pins": [{"pin", "predicted"}]}
create or replace function public.launch_tidy()
returns json
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  pins json;
begin
  update agi1_launch_drafts o set pin_id = null
  where o.pin_id is not null and o.token is null
    and exists (select 1 from agi1_launch_drafts l where l.cid = o.cid and l.token is not null);
  delete from agi1_launch_drafts where created_at < now() - interval '7 days' and (pin_id is null or token is not null);
  delete from agi1_launch_chats where day < today;
  delete from agi1_launch_wallets where day < today - 1;
  delete from agi1_launch_days where day < today - 30;
  select coalesce(json_agg(json_build_object('pin', p.pin_id, 'predicted', p.predicted)), '[]'::json) into pins from (
    select d.pin_id, d.predicted from agi1_launch_drafts d
    where d.pin_id is not null and d.token is null and d.expires_at < now() - interval '1 hour'
      and not exists (select 1 from agi1_launch_drafts o where o.cid = d.cid and o.id <> d.id
                        and (o.token is not null or o.expires_at > now() - interval '1 hour'))
    order by d.expires_at limit 50) p;
  return json_build_object('pins', pins);
end;
$$;

-- Those pictures are deleted at Pinata (or kept for good: a coin was there). → how many drafts forgot their picture's Pinata id
create or replace function public.launch_unpinned(p_pins text[])
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  if p_pins is null or cardinality(p_pins) > 50 then return 0; end if;
  update agi1_launch_drafts set pin_id = null where pin_id = any(p_pins) and token is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.launch_draft_put(text, text, text, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.launch_draft_get(text) from public, anon, authenticated;
revoke all on function public.launch_prepare(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.launch_upload_back(text) from public, anon, authenticated;
revoke all on function public.launch_set_cid(text, text, text) from public, anon, authenticated;
revoke all on function public.launch_predicted(text, text, text) from public, anon, authenticated;
revoke all on function public.launch_done(text, text, text, text) from public, anon, authenticated;
revoke all on function public.launch_gas_claim(text, text, numeric, integer, numeric) from public, anon, authenticated;
revoke all on function public.launch_gas_sending(text, text) from public, anon, authenticated;
revoke all on function public.launch_gas_sent(text, text, boolean) from public, anon, authenticated;
revoke all on function public.launch_tidy() from public, anon, authenticated;
revoke all on function public.launch_unpinned(text[]) from public, anon, authenticated;
grant execute on function public.launch_draft_put(text, text, text, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.launch_draft_get(text) to service_role;
grant execute on function public.launch_prepare(text, text, integer, integer) to service_role;
grant execute on function public.launch_upload_back(text) to service_role;
grant execute on function public.launch_set_cid(text, text, text) to service_role;
grant execute on function public.launch_predicted(text, text, text) to service_role;
grant execute on function public.launch_done(text, text, text, text) to service_role;
grant execute on function public.launch_gas_claim(text, text, numeric, integer, numeric) to service_role;
grant execute on function public.launch_gas_sending(text, text) to service_role;
grant execute on function public.launch_gas_sent(text, text, boolean) to service_role;
grant execute on function public.launch_tidy() to service_role;
grant execute on function public.launch_unpinned(text[]) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- (an earlier version's launch_gas_sending, with one argument)
drop function if exists public.launch_gas_sending(text);

-- Check: this should show launch_functions_found = 12.
select count(*) as launch_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('launch_draft_put', 'launch_draft_get', 'launch_prepare', 'launch_upload_back', 'launch_set_cid', 'launch_predicted',
    'launch_done', 'launch_gas_claim', 'launch_gas_sending', 'launch_gas_sent', 'launch_tidy', 'launch_unpinned');
