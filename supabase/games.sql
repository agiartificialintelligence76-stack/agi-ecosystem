-- AGI-1's games in her Telegram groups (2026-10-09, the owner: "can i add games on the tg bot like riddles, questions, if
-- the person in that telegram group answered correctly they will get a small amount of $AGI, they will reply with their
-- address and get it", then "make this better then continue"). The better version, with the owner's choices:
--   • a few times a day, at random times, she posts a quiz in each of her groups (TELEGRAM_GROUPS): a Telegram quiz poll,
--     open 10 minutes (server/games.js, the questions in server/game-questions.js);
--   • when it closes, ONE person who got it right is picked at random (so the fastest bot doesn't win every time): one
--     win a day each, GAME_WINS_A_DAY wins a day for the whole site (10, the owner's), GAME_PRIZE $AGI each (250);
--   • the winner claims it in her private chat (the owner's choice, over replying in the group; 18+, the owner's: her
--     private chat's own check): /claim, their address, "yes, send it", and her prize wallet (PRIZE_WALLET_KEY, the
--     owner's: a small wallet made only for this) sends it. A prize waits 24 hours for a claim to start, then 7 days.
-- This file gives it what it needs from the database, and the clock that runs it every 2 minutes.
--
-- Before running it (once, in the Supabase project that SUPABASE_URL points to; the same two switches as her buy bot,
-- supabase/buys.sql: skip them if they're already on):
--   1. Integrations → Cron → enable it (the pg_cron extension: Supabase's own scheduler)
--   2. Database → Extensions → search "pg_net" → enable it (lets the scheduler call our site)
-- Then: SQL Editor → New query → paste all of this → Run. It ends by showing games_ready = 1 (the database part) and
-- games_scheduled = 1 (the clock). games_scheduled = 0: step 1 or 2 isn't done yet; do it, then run this file again.
-- It only ADDS tables, functions and two cron jobs (all named agi1_game… / game_… / agi1-games…). Nothing the original site
-- uses changes. Running it again changes nothing that's saved (its key stays the same).
--
-- What's kept, and why (only the server's secret key can read or change any of it):
--   agi1_game_state    one row: a random key, made here once, that the clock sends with each call; the questions asked
--                      lately (never asked again for a while)
--   agi1_game_groups   per group (its @username or id, as TELEGRAM_GROUPS names it): when its next game is due
--   agi1_game_rounds   per game: the group's id, the poll's ids, which question, which answer was right, when it closes;
--                      30 days
--   agi1_game_answers  per game and person who answered: their Telegram account's id and the first name Telegram shows
--                      (to mention the winner), and whether they were right; 3 days
--   agi1_game_prizes   per prize: the winner's Telegram account's id, how much, and once they claim it the address they
--                      gave and its public transaction; 60 days
--   agi1_game_days     per day (UTC): how many prizes were won
-- Never a message, a phone number, a username or anything else about anyone.

create table if not exists public.agi1_game_state (
  id     smallint primary key default 1 check (id = 1),
  key    text     not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  recent text[]   not null default '{}'
);
insert into public.agi1_game_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.agi1_game_groups (
  target  text        primary key check (target ~ '^(@[a-z0-9_]{4,32}|-[0-9]{5,20})$'),
  next_at timestamptz not null
);

create table if not exists public.agi1_game_rounds (
  id         bigserial   primary key,
  chat       bigint      not null check (chat < 0),
  message_id bigint      not null check (message_id > 0),
  poll       text        not null unique check (char_length(poll) between 1 and 64),
  question   text        not null check (question ~ '^[a-z0-9-]{2,24}$'),
  correct    smallint    not null check (correct between 0 and 9),
  answer     text        not null check (char_length(answer) between 1 and 100),
  prize      boolean     not null,
  opened     timestamptz not null default now(),
  closes     timestamptz not null,
  settled    timestamptz,
  winners    integer,
  prize_id   bigint
);
create index if not exists agi1_game_rounds_open on public.agi1_game_rounds (closes) where settled is null;
create index if not exists agi1_game_rounds_opened on public.agi1_game_rounds (opened);

create table if not exists public.agi1_game_answers (
  round_id bigint      not null references public.agi1_game_rounds (id) on delete cascade,
  person   bigint      not null check (person > 0),
  name     text        not null check (char_length(name) between 1 and 32),
  correct  boolean     not null,
  at       timestamptz not null default now(),
  primary key (round_id, person)
);
create index if not exists agi1_game_answers_at on public.agi1_game_answers (at);

create table if not exists public.agi1_game_prizes (
  id       bigserial   primary key,
  round_id bigint      not null,
  person   bigint      not null check (person > 0),
  amount   numeric     not null check (amount > 0 and amount <= 1000000),
  state    text        not null default 'won' check (state in ('won', 'confirming', 'claimed', 'sending', 'sent', 'expired')),
  address  text        check (address ~ '^0x[0-9a-f]{40}$'),
  tx       text        check (tx ~ '^0x[0-9a-f]{64}$'),
  won      timestamptz not null default now(),
  expires  timestamptz not null,
  claimed  timestamptz,
  sent     timestamptz
);
create index if not exists agi1_game_prizes_person on public.agi1_game_prizes (person, won);
create index if not exists agi1_game_prizes_won on public.agi1_game_prizes (won);

create table if not exists public.agi1_game_days (
  day  date    primary key,
  wins integer not null default 0 check (wins >= 0)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_game_state enable row level security;
alter table public.agi1_game_groups enable row level security;
alter table public.agi1_game_rounds enable row level security;
alter table public.agi1_game_answers enable row level security;
alter table public.agi1_game_prizes enable row level security;
alter table public.agi1_game_days enable row level security;
revoke all on table public.agi1_game_state, public.agi1_game_groups, public.agi1_game_rounds, public.agi1_game_answers,
  public.agi1_game_prizes, public.agi1_game_days from anon, authenticated;

-- The key the clock sends (our server reads it, to check each call really comes from here)
create or replace function public.game_key()
returns text
language sql
stable
set search_path = public
as $$
  select key from agi1_game_state where id = 1;
$$;

-- Is a group's next game due? (p_target: its @username in lowercase, or its id; p_minutes: about how often, in minutes.)
-- The first time a group is seen: its first game in 30 to 90 minutes. When one is due: true, once (two calls at once
-- never both get it), and the next one is set 0.6 to 1.4 times p_minutes away (random, so nobody can tell when).
create or replace function public.game_due(p_target text, p_minutes integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_target is null or p_target !~ '^(@[a-z0-9_]{4,32}|-[0-9]{5,20})$' or p_minutes is null or p_minutes < 10 or p_minutes > 1440 then
    return false;
  end if;
  insert into agi1_game_groups (target, next_at) values (p_target, now() + make_interval(mins => 30 + floor(random() * 61)::integer))
  on conflict (target) do nothing;
  if found then
    return false;
  end if;
  update agi1_game_groups set next_at = now() + make_interval(secs => p_minutes * 60 * (0.6 + random() * 0.8))
  where target = p_target and next_at <= now();
  return found;
end;
$$;

-- The prizes still on offer today (UTC) under a cap of p_cap → 0 or more
create or replace function public.game_left(p_cap integer)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(0, coalesce(p_cap, 0) - coalesce((select wins from agi1_game_days where day = (now() at time zone 'utc')::date), 0));
$$;

-- The questions asked lately (oldest first)
create or replace function public.game_recent()
returns text[]
language sql
stable
set search_path = public
as $$
  select recent from agi1_game_state where id = 1;
$$;

-- A game was just posted: its round, and its question kept as recent (the newest 60). → the round's id, or null (bad
-- input, or a poll already known)
create or replace function public.game_open(p_chat bigint, p_message bigint, p_poll text, p_question text, p_correct integer,
  p_answer text, p_prize boolean, p_seconds integer)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id     bigint;
  v_recent text[];
begin
  if p_chat is null or p_chat >= 0 or p_message is null or p_message <= 0 or p_poll is null or char_length(p_poll) not between 1 and 64
    or p_question is null or p_question !~ '^[a-z0-9-]{2,24}$' or p_correct is null or p_correct not between 0 and 9
    or p_answer is null or char_length(p_answer) not between 1 and 100 or p_prize is null or p_seconds is null or p_seconds not between 30 and 900 then
    return null;
  end if;
  insert into agi1_game_rounds (chat, message_id, poll, question, correct, answer, prize, closes)
  values (p_chat, p_message, p_poll, p_question, p_correct, p_answer, p_prize, now() + make_interval(secs => p_seconds))
  on conflict (poll) do nothing
  returning id into v_id;
  select array_append(array_remove(recent, p_question), p_question) into v_recent from agi1_game_state where id = 1;
  if cardinality(v_recent) > 60 then
    v_recent := v_recent[cardinality(v_recent) - 59:cardinality(v_recent)];
  end if;
  update agi1_game_state set recent = v_recent where id = 1;
  return v_id;
end;
$$;

-- Someone answered a game's poll (Telegram's poll_answer). → 'ok' (kept) · 'again' (they already answered: Telegram allows
-- one answer) · 'closed' (too late) · 'unknown' (not one of our games) · 'bad' (bad input)
create or replace function public.game_answer(p_poll text, p_person bigint, p_name text, p_option integer)
returns text
language plpgsql
set search_path = public
as $$
declare
  r agi1_game_rounds;
begin
  if p_poll is null or char_length(p_poll) not between 1 and 64 or p_person is null or p_person <= 0
    or p_name is null or char_length(p_name) not between 1 and 32 or p_option is null or p_option not between 0 and 9 then
    return 'bad';
  end if;
  select * into r from agi1_game_rounds where poll = p_poll;
  if not found then
    return 'unknown';
  end if;
  if r.settled is not null or now() > r.closes + interval '15 seconds' then
    return 'closed';
  end if;
  insert into agi1_game_answers (round_id, person, name, correct) values (r.id, p_person, p_name, p_option = r.correct)
  on conflict (round_id, person) do nothing;
  return case when found then 'ok' else 'again' end;
end;
$$;

-- A game closed: settled once (two calls at once: one settles it). One person who got it right is picked at random,
-- among those who haven't won anything today (UTC), while the day's prizes (p_cap) last; the prize is p_amount $AGI,
-- theirs to claim for 24 hours. → { ok: true, chat, message_id, answer, right (how many got it right), why: null (a winner)
-- | 'none' (nobody got it right) | 'no_prize' (a game posted just for fun) | 'cap' (the day's prizes are won) | 'all_won'
-- (everyone who got it right already won today), winner: { person, name, prize, amount } | null } · { ok: false, why:
-- 'unknown' | 'open' (it hasn't closed yet) | 'settled' (already done) }
create or replace function public.game_settle(p_poll text, p_cap integer, p_amount numeric)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r       agi1_game_rounds;
  v_day   date := (now() at time zone 'utc')::date;
  v_right integer;
  v_wins  integer;
  v_why   text;
  v_prize bigint;
  v_who   bigint;
  v_name  text;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_cap is null or p_cap < 0 then
    return jsonb_build_object('ok', false, 'why', 'bad');
  end if;
  update agi1_game_rounds set settled = now()
  where poll = p_poll and settled is null and closes <= now() + interval '5 seconds'
  returning * into r;
  if not found then
    select * into r from agi1_game_rounds where poll = p_poll;
    if not found then
      return jsonb_build_object('ok', false, 'why', 'unknown');
    end if;
    return jsonb_build_object('ok', false, 'why', case when r.settled is null then 'open' else 'settled' end);
  end if;
  select count(*) into v_right from agi1_game_answers where round_id = r.id and correct;
  if v_right = 0 then
    v_why := 'none';
  elsif not r.prize then
    v_why := 'no_prize';
  else
    -- the day's wins, locked: two games closing at once can't both take the last prize
    insert into agi1_game_days (day, wins) values (v_day, 0) on conflict (day) do nothing;
    select wins into v_wins from agi1_game_days where day = v_day for update;
    if v_wins >= p_cap then
      v_why := 'cap';
    else
      select a.person, a.name into v_who, v_name from agi1_game_answers a
      where a.round_id = r.id and a.correct
        and not exists (select 1 from agi1_game_prizes p where p.person = a.person and (p.won at time zone 'utc')::date = v_day)
      order by random()
      limit 1;
      if v_who is null then
        v_why := 'all_won';
      else
        insert into agi1_game_prizes (round_id, person, amount, expires) values (r.id, v_who, p_amount, now() + interval '24 hours')
        returning id into v_prize;
        update agi1_game_days set wins = wins + 1 where day = v_day;
      end if;
    end if;
  end if;
  update agi1_game_rounds set winners = v_right, prize_id = v_prize where id = r.id;
  return jsonb_build_object('ok', true, 'chat', r.chat, 'message_id', r.message_id, 'answer', r.answer, 'right', v_right, 'why', v_why,
    'winner', case when v_prize is null then null else jsonb_build_object('person', v_who, 'name', v_name, 'prize', v_prize, 'amount', p_amount) end);
end;
$$;

-- The games that closed over 20 seconds ago and nobody settled yet (a closing Telegram didn't tell us about) → poll ids
create or replace function public.game_unsettled()
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(poll), '{}') from (
    select poll from agi1_game_rounds where settled is null and closes < now() - interval '20 seconds' order by closes limit 10
  ) x;
$$;

-- A person's prize to talk about → { id, amount, state, address, tx, expires, claimed, sent } or null: one still being
-- claimed first (the oldest: two prizes won on two days are claimed one after the other), else their newest from the last
-- 2 days (sent or expired). A prize nobody started claiming in its 24 hours is marked expired here.
create or replace function public.game_pending(p_person bigint)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v agi1_game_prizes;
begin
  if p_person is null or p_person <= 0 then
    return null;
  end if;
  update agi1_game_prizes set state = 'expired'
  where person = p_person and state in ('won', 'confirming') and expires <= now();
  select * into v from agi1_game_prizes
  where person = p_person and (state in ('won', 'confirming', 'claimed', 'sending') or won > now() - interval '2 days')
  order by (state in ('won', 'confirming', 'claimed', 'sending')) desc,
    case when state in ('won', 'confirming', 'claimed', 'sending') then won end asc,
    won desc
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object('id', v.id, 'amount', v.amount, 'state', v.state, 'address', v.address, 'tx', v.tx,
    'expires', v.expires, 'claimed', v.claimed, 'sent', v.sent);
end;
$$;

-- The address a winner gave for their prize (only theirs, while it can still be claimed) → true / false. Once they've
-- started claiming in time, it waits for them 7 days (her prize wallet may need a top-up first, say)
create or replace function public.game_address(p_prize bigint, p_person bigint, p_address text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_address is null or lower(p_address) !~ '^0x[0-9a-f]{40}$' then
    return false;
  end if;
  update agi1_game_prizes set address = lower(p_address), state = 'confirming', expires = greatest(expires, now() + interval '7 days')
  where id = p_prize and person = p_person and state in ('won', 'confirming') and expires > now();
  return found;
end;
$$;

-- "Yes, send it": the prize is claimed for sending, once (a claim that never got as far as sending is given back after
-- 2 minutes). → { ok: true, address, amount } · { ok: false, why: 'won' (no address yet) | 'expired' | 'claimed' (being sent
-- right now) | 'sending' | 'sent' | 'unknown', tx, amount }
create or replace function public.game_claim(p_prize bigint, p_person bigint)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v agi1_game_prizes;
begin
  update agi1_game_prizes set state = 'claimed', claimed = now()
  where id = p_prize and person = p_person and address is not null
    and ((state = 'confirming' and expires > now()) or (state = 'claimed' and claimed < now() - interval '2 minutes'))
  returning * into v;
  if found then
    return jsonb_build_object('ok', true, 'address', v.address, 'amount', v.amount);
  end if;
  select * into v from agi1_game_prizes where id = p_prize and person = p_person;
  if not found then
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  return jsonb_build_object('ok', false, 'tx', v.tx, 'amount', v.amount,
    'why', case when v.state in ('won', 'confirming') and v.expires <= now() then 'expired' else v.state end);
end;
$$;

-- The prize's transaction, kept right before it's sent (so it's never sent twice) → true / false
create or replace function public.game_sending(p_prize bigint, p_tx text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then
    return false;
  end if;
  update agi1_game_prizes set state = 'sending', tx = p_tx where id = p_prize and state in ('claimed', 'sending');
  return found;
end;
$$;

-- How sending went: sent (with its transaction), or nothing went out (back to "yes, send it?": they can try again; also a
-- prize whose transaction p_tx failed on the chain, so its $AGI never moved) → true / false
create or replace function public.game_sent(p_prize bigint, p_tx text, p_ok boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_ok then
    if p_tx is null or p_tx !~ '^0x[0-9a-f]{64}$' then
      return false;
    end if;
    update agi1_game_prizes set state = 'sent', tx = p_tx, sent = now() where id = p_prize and state in ('claimed', 'sending');
  else
    update agi1_game_prizes set state = 'confirming', tx = null, sent = null
    where id = p_prize and (state in ('claimed', 'sending') or (state = 'sent' and p_tx is not null and tx = p_tx));
  end if;
  return found;
end;
$$;

-- The tidy-up (each clock tick): prizes nobody claimed in 24 hours expire; answers go after 3 days, games after 30, prizes
-- and days after 60. → how many rows went
create or replace function public.game_tidy()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer := 0;
  m integer;
begin
  update agi1_game_prizes set state = 'expired' where state in ('won', 'confirming') and expires <= now();
  delete from agi1_game_answers where at < now() - interval '3 days';
  get diagnostics m = row_count; n := n + m;
  delete from agi1_game_rounds where opened < now() - interval '30 days';
  get diagnostics m = row_count; n := n + m;
  delete from agi1_game_prizes where won < now() - interval '60 days';
  get diagnostics m = row_count; n := n + m;
  delete from agi1_game_days where day < (now() at time zone 'utc')::date - 60;
  get diagnostics m = row_count; n := n + m;
  return n;
end;
$$;

-- Only the server's secret key may call them.
revoke all on function public.game_key() from public, anon, authenticated;
revoke all on function public.game_due(text, integer) from public, anon, authenticated;
revoke all on function public.game_left(integer) from public, anon, authenticated;
revoke all on function public.game_recent() from public, anon, authenticated;
revoke all on function public.game_open(bigint, bigint, text, text, integer, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.game_answer(text, bigint, text, integer) from public, anon, authenticated;
revoke all on function public.game_settle(text, integer, numeric) from public, anon, authenticated;
revoke all on function public.game_unsettled() from public, anon, authenticated;
revoke all on function public.game_pending(bigint) from public, anon, authenticated;
revoke all on function public.game_address(bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.game_claim(bigint, bigint) from public, anon, authenticated;
revoke all on function public.game_sending(bigint, text) from public, anon, authenticated;
revoke all on function public.game_sent(bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.game_tidy() from public, anon, authenticated;
grant execute on function public.game_key() to service_role;
grant execute on function public.game_due(text, integer) to service_role;
grant execute on function public.game_left(integer) to service_role;
grant execute on function public.game_recent() to service_role;
grant execute on function public.game_open(bigint, bigint, text, text, integer, text, boolean, integer) to service_role;
grant execute on function public.game_answer(text, bigint, text, integer) to service_role;
grant execute on function public.game_settle(text, integer, numeric) to service_role;
grant execute on function public.game_unsettled() to service_role;
grant execute on function public.game_pending(bigint) to service_role;
grant execute on function public.game_address(bigint, bigint, text) to service_role;
grant execute on function public.game_claim(bigint, bigint) to service_role;
grant execute on function public.game_sending(bigint, text) to service_role;
grant execute on function public.game_sent(bigint, text, boolean) to service_role;
grant execute on function public.game_tidy() to service_role;

-- The clock: every 2 minutes, Supabase Cron calls our site's games with the key (pg_net, an HTTPS request; nothing else is
-- sent): a game when one is due, settling a game Telegram didn't tell us closed, the tidy-up. Its run history is tidied
-- once a day (the same job as her buy bot's: whichever file ran last set it). Only when both switches above are on.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('agi1-games', '*/2 * * * *', $cmd$
      select net.http_get(
        url := 'https://www.agi1.app/api/feed?games',
        headers := jsonb_build_object('Authorization', 'Bearer ' || (select key from public.agi1_game_state where id = 1)),
        timeout_milliseconds := 25000
      );
    $cmd$);
    perform cron.schedule('agi1-buys-tidy', '17 3 * * *', $cmd$
      delete from cron.job_run_details where end_time < now() - interval '3 days';
    $cmd$);
  else
    raise notice 'The games'' clock is not set yet: switch on Integrations → Cron (pg_cron) and Database → Extensions → pg_net, then run this file again';
  end if;
end
$do$;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: games_ready = 1 (the database part: its 14 functions), games_scheduled = 1 (the clock, every 2 minutes).
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('game_key', 'game_due', 'game_left', 'game_recent',
    'game_open', 'game_answer', 'game_settle', 'game_unsettled', 'game_pending', 'game_address', 'game_claim', 'game_sending', 'game_sent',
    'game_tidy')) / 14 as games_ready,
  (select count(*) from pg_extension where extname = 'pg_cron') * (select count(*) from pg_extension where extname = 'pg_net') as games_scheduled;
