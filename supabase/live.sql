-- AGI-1's live show (2026-10-02, the owner's idea: "what if she livestreams on X and reads the comments and reacts to it").
-- Run this once in the Supabase project that SUPABASE_URL points to, any time: SQL Editor → New query → paste all of it →
-- Run. It ends by showing live_functions_found = 12. **Until it's run, agi1.app/live says her show is coming soon** and
-- nobody can send a question.
-- It only ADDS two new tables and twelve functions (all named agi1_live… / live_…). It doesn't touch any table the original
-- site uses, so it's safe in the database both sites share. Running it again changes nothing that's saved.
--
-- How it works: while her show is on (her stream runner, on the owner's own server, says so every few seconds), people
-- send her questions at agi1.app/live or with /live in her Telegram bot. Our server checks each question first (18+, a
-- human check on the site, PG-13, no links, addresses, @names or other coins) and keeps it here in a line. The runner takes
-- them one at a time: our server asks the AI for her answer (and whether it's fine for a public stream at all), the runner
-- shows the question on her stream with the name they gave (if any) and she answers it out loud.
-- The owner can pause her, skip a question, block words, clear the line and end the show from a phone (agi1.app/live with
-- the owner's link).
--
-- What's kept (at most 2 days: the keep-alive deletes older questions; never an IP address or a Telegram chat's number):
--   agi1_live_questions  each question: when, from where (web / telegram), a daily code of who asked (an HMAC: the same
--                        person today, nothing else), the name they gave (optional), the question, where it is (waiting,
--                        taken, answered, skipped) and why it was skipped, and her answer once she has one
--   agi1_live_state      one row: whether she's on (and when the runner last said so), the show's number, its segment, the
--                        question on air, when the next show is, and the owner's controls (paused, new questions closed,
--                        the show asked to end, blocked words)
-- Only the server (the secret key) can use them.

create table if not exists public.agi1_live_questions (
  id         bigserial   primary key,
  created_at timestamptz not null default now(),
  show_id    bigint      not null default 0,
  source     text        not null check (source in ('web', 'telegram')),
  asker      text        not null check (char_length(asker) between 16 and 64),
  name       text        check (name is null or char_length(name) between 1 and 24),
  question   text        not null check (char_length(question) between 3 and 200),
  status     text        not null default 'waiting' check (status in ('waiting', 'taken', 'answered', 'skipped')),
  why        text        check (why is null or why in ('rules', 'care', 'owner', 'ended', 'error')),
  tries      smallint    not null default 0,
  taken_at   timestamptz,
  done_at    timestamptz,
  reply      text        check (reply is null or char_length(reply) <= 600),
  mood       text        check (mood is null or char_length(mood) <= 16)
);
create index if not exists agi1_live_questions_line on public.agi1_live_questions (status, id);
create index if not exists agi1_live_questions_asker on public.agi1_live_questions (asker, created_at);
create index if not exists agi1_live_questions_made on public.agi1_live_questions (created_at);

create table if not exists public.agi1_live_state (
  id         smallint    primary key default 1 check (id = 1),
  status     text        not null default 'off' check (status in ('off', 'starting', 'live', 'brb', 'ending')),
  show_id    bigint      not null default 0,
  started_at timestamptz,
  beat_at    timestamptz,                                  -- the runner's last word
  next_at    timestamptz,                                  -- the next show (the runner says)
  segment    text        check (segment is null or char_length(segment) <= 60),
  now_id     bigint,                                       -- the question on air
  paused     boolean     not null default false,           -- the owner: "be right back"
  closed     boolean     not null default false,           -- the owner: no new questions for now
  end_asked  boolean     not null default false,           -- the owner: end the show
  blocked    text[]      not null default '{}',            -- the owner's blocked words (lowercase, at most 100)
  updated_at timestamptz not null default now()
);
insert into public.agi1_live_state (id) values (1) on conflict (id) do nothing;

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_live_questions enable row level security;
alter table public.agi1_live_state enable row level security;
revoke all on table public.agi1_live_questions from anon, authenticated;
revoke all on table public.agi1_live_state from anon, authenticated;
revoke all on sequence public.agi1_live_questions_id_seq from anon, authenticated;

-- Is she on? Only while the runner said so in the last p_beat seconds (a runner that stopped or crashed: off).
create or replace function public.live_on_air(s agi1_live_state, p_beat integer)
returns boolean
language sql
stable
set search_path = public
as $$
  select s.status <> 'off' and s.beat_at is not null and s.beat_at > now() - make_interval(secs => greatest(p_beat, 5));
$$;

-- A question for her show (from our server, after its own checks: 18+, the human check, PG-13, no links…).
-- p_source: 'web' or 'telegram' · p_asker: a daily code of who asked · p_name: the name to show, or null · p_question ·
-- p_gap: seconds between one person's questions · p_per_day: one person's questions a day · p_queue: questions waiting at
-- most · p_site_day: questions a day for the whole site · p_beat: seconds since the runner's last word that still count as on.
-- → {"ok": true, "id", "position"} or {"ok": false, "why": "bad" | "offline" | "ending" | "closed" | "blocked" | "waiting"
--   (with "id" and "position": their question is still in line) | "too_fast" (with "wait", seconds) | "day_cap" | "site_cap"
--   | "full"}
create or replace function public.live_ask(p_source text, p_asker text, p_name text, p_question text,
  p_gap integer, p_per_day integer, p_queue integer, p_site_day integer, p_beat integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  s agi1_live_state%rowtype;
  mine agi1_live_questions%rowtype;
  last_at timestamptz;
  n integer;
  new_id bigint;
begin
  if p_source is null or p_source not in ('web', 'telegram') or p_asker is null or char_length(p_asker) not between 16 and 64
     or (p_name is not null and char_length(p_name) not between 1 and 24)
     or p_question is null or char_length(p_question) not between 3 and 200
     or p_gap is null or p_gap < 0 or p_per_day is null or p_per_day < 1 or p_queue is null or p_queue < 1
     or p_site_day is null or p_site_day < 1 or p_beat is null or p_beat < 5 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- one question at a time joins the line (so the line's size and each person's limits are always counted right)
  select * into s from agi1_live_state where id = 1 for update;
  if not found or not live_on_air(s, p_beat) then return json_build_object('ok', false, 'why', 'offline'); end if;
  if s.status = 'ending' then return json_build_object('ok', false, 'why', 'ending'); end if;
  if s.closed then return json_build_object('ok', false, 'why', 'closed'); end if;
  if exists (select 1 from unnest(s.blocked) w
             where position(w in lower(p_question)) > 0 or position(w in lower(coalesce(p_name, ''))) > 0) then
    return json_build_object('ok', false, 'why', 'blocked');
  end if;
  -- their question is still in line: one at a time
  select * into mine from agi1_live_questions
  where asker = p_asker and status in ('waiting', 'taken') order by id desc limit 1;
  if found then
    return json_build_object('ok', false, 'why', 'waiting', 'id', mine.id,
      'position', (select count(*) from agi1_live_questions where status = 'waiting' and id <= mine.id));
  end if;
  select max(created_at) into last_at from agi1_live_questions where asker = p_asker;
  if last_at is not null and last_at > now() - make_interval(secs => p_gap) then
    return json_build_object('ok', false, 'why', 'too_fast',
      'wait', ceil(extract(epoch from (last_at + make_interval(secs => p_gap) - now())))::integer);
  end if;
  select count(*) into n from agi1_live_questions
  where asker = p_asker and created_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc';
  if n >= p_per_day then return json_build_object('ok', false, 'why', 'day_cap'); end if;
  select count(*) into n from agi1_live_questions
  where created_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc';
  if n >= p_site_day then return json_build_object('ok', false, 'why', 'site_cap'); end if;
  select count(*) into n from agi1_live_questions where status = 'waiting';
  if n >= p_queue then return json_build_object('ok', false, 'why', 'full'); end if;
  insert into agi1_live_questions (show_id, source, asker, name, question)
  values (s.show_id, p_source, p_asker, p_name, p_question)
  returning id into new_id;
  return json_build_object('ok', true, 'id', new_id, 'position', n + 1);
end;
$$;

-- One question, for the person who asked it (the page's ticket, or her bot by their daily code): where it is.
-- p_id: the question (or null) · p_asker: their daily code (or null: then their newest question today)
-- → null (no such question) or {"id", "status": "waiting" | "taken" | "answered" | "skipped", "on_air" (true while she's
--   answering it), "position" (waiting: their place in line), "why" (skipped), "reply" (answered: what she said), "name",
--   "question"}
create or replace function public.live_lookup(p_id bigint, p_asker text)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('id', q.id, 'status', q.status, 'on_air', q.status = 'taken' and s.now_id is not distinct from q.id,
    'position', case when q.status = 'waiting'
      then (select count(*) from agi1_live_questions w where w.status = 'waiting' and w.id <= q.id) end,
    'why', q.why, 'reply', case when q.status = 'answered' then q.reply end, 'name', q.name, 'question', q.question)
  from agi1_live_questions q
  left join agi1_live_state s on s.id = 1
  where (p_id is not null and q.id = p_id)
     or (p_id is null and p_asker is not null and q.asker = p_asker
         and q.created_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc')
  order by q.id desc
  limit 1;
$$;

-- The runner starts a show: a new show number, the owner's controls reset, anything left in line from an earlier show
-- skipped ("ended"). p_status: 'starting' (her "starting soon" screen) or 'live'. → {"show": the new number}
create or replace function public.live_start(p_status text)
returns json
language plpgsql
set search_path = public
as $$
declare
  n bigint;
begin
  if p_status is null or p_status not in ('starting', 'live') then return json_build_object('ok', false, 'why', 'bad'); end if;
  update agi1_live_questions set status = 'skipped', why = 'ended', done_at = now() where status in ('waiting', 'taken');
  update agi1_live_state
  set status = p_status, show_id = show_id + 1, started_at = now(), beat_at = now(), segment = null, now_id = null,
      paused = false, closed = false, end_asked = false, updated_at = now()
  where id = 1
  returning show_id into n;
  return json_build_object('ok', true, 'show', n);
end;
$$;

-- The runner's word, every few seconds: what she's doing (the status, the segment, the question on air), for this show.
-- → {"ok": true, "paused", "closed", "end", "blocked", "skipped": [ids the owner skipped or dropped in the last 2 minutes],
--   "waiting": questions in line} or {"ok": false, "why": "old_show"} (another show started since: this runner must stop)
create or replace function public.live_beat(p_show bigint, p_status text, p_segment text, p_now bigint)
returns json
language plpgsql
set search_path = public
as $$
declare
  s agi1_live_state%rowtype;
begin
  if p_status is null or p_status not in ('starting', 'live', 'brb', 'ending')
     or (p_segment is not null and char_length(p_segment) > 60) then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into s from agi1_live_state where id = 1 for update;
  if not found or s.show_id <> p_show then return json_build_object('ok', false, 'why', 'old_show'); end if;
  update agi1_live_state
  set status = p_status, beat_at = now(), segment = p_segment, now_id = p_now, updated_at = now()
  where id = 1
  returning * into s;
  return json_build_object('ok', true, 'paused', s.paused, 'closed', s.closed, 'end', s.end_asked, 'blocked', s.blocked,
    'skipped', coalesce((select json_agg(q.id order by q.id) from agi1_live_questions q
      where q.status = 'skipped' and q.why = 'owner' and q.done_at > now() - interval '2 minutes'), '[]'::json),
    'waiting', (select count(*) from agi1_live_questions where status = 'waiting'));
end;
$$;

-- The runner ends the show: off, and anything still in line is skipped ("ended"). p_next: when the next show is (or null).
create or replace function public.live_stop(p_show bigint, p_next timestamptz)
returns json
language plpgsql
set search_path = public
as $$
declare
  s agi1_live_state%rowtype;
begin
  select * into s from agi1_live_state where id = 1 for update;
  if not found or s.show_id <> p_show then return json_build_object('ok', false, 'why', 'old_show'); end if;
  update agi1_live_questions set status = 'skipped', why = 'ended', done_at = now() where status in ('waiting', 'taken');
  update agi1_live_state
  set status = 'off', segment = null, now_id = null, paused = false, end_asked = false, updated_at = now(),
      next_at = case when p_next is not null and p_next > now() then p_next else next_at end
  where id = 1;
  return json_build_object('ok', true);
end;
$$;

-- When her next show is (the runner's schedule: shown on agi1.app/live). A time in the past, or null, clears it.
create or replace function public.live_schedule(p_next timestamptz)
returns json
language sql
set search_path = public
as $$
  update agi1_live_state set next_at = case when p_next > now() then p_next end, updated_at = now() where id = 1
  returning json_build_object('ok', true, 'next', next_at);
$$;

-- The next question in line, for the runner (our server then asks the AI for her answer). Questions taken more than 5
-- minutes ago and never finished (a runner that crashed) are skipped first ("error"). → null (nobody waiting) or
-- {"id", "name", "question", "source", "tries"}
create or replace function public.live_take(p_show bigint)
returns json
language plpgsql
set search_path = public
as $$
declare
  q agi1_live_questions%rowtype;
begin
  if not exists (select 1 from agi1_live_state where id = 1 and show_id = p_show and status <> 'off') then return null; end if;
  update agi1_live_questions set status = 'skipped', why = 'error', done_at = now()
  where status = 'taken' and taken_at < now() - interval '5 minutes';
  select * into q from agi1_live_questions where status = 'waiting' order by id limit 1 for update skip locked;
  if not found then return null; end if;
  update agi1_live_questions set status = 'taken', taken_at = now(), tries = tries + 1 where id = q.id returning * into q;
  return json_build_object('id', q.id, 'name', q.name, 'question', q.question, 'source', q.source, 'tries', q.tries);
end;
$$;

-- Where a taken question goes next. p_status:
--   'taken'    her answer is ready (p_reply, p_mood): kept for the person who asked
--   'waiting'  the AI couldn't answer just now: back in line (its second failure: skipped, "error")
--   'answered' she said it on stream
--   'skipped'  with p_why: 'rules' (not for a public stream), 'care' (someone who may need support, never aired), 'owner'
--              (the owner skipped it), 'ended' (the show ended first), 'error'
-- → {"ok": true, "status"} or {"ok": false} (not a question in that state any more: e.g. the owner skipped it meanwhile)
create or replace function public.live_done(p_id bigint, p_status text, p_why text, p_reply text, p_mood text)
returns json
language plpgsql
set search_path = public
as $$
declare
  q agi1_live_questions%rowtype;
begin
  select * into q from agi1_live_questions where id = p_id for update;
  if not found then return json_build_object('ok', false); end if;
  if p_status = 'taken' and q.status = 'taken' and p_reply is not null and char_length(p_reply) between 1 and 600
     and (p_mood is null or char_length(p_mood) <= 16) then
    update agi1_live_questions set reply = p_reply, mood = p_mood where id = p_id;
  elsif p_status = 'waiting' and q.status = 'taken' then
    if q.tries >= 2 then
      update agi1_live_questions set status = 'skipped', why = 'error', done_at = now() where id = p_id;
      return json_build_object('ok', true, 'status', 'skipped');
    end if;
    update agi1_live_questions set status = 'waiting', taken_at = null where id = p_id;
  elsif p_status = 'answered' and q.status = 'taken' and q.reply is not null then
    update agi1_live_questions set status = 'answered', done_at = now() where id = p_id;
  elsif p_status = 'skipped' and q.status in ('waiting', 'taken') and p_why in ('rules', 'care', 'owner', 'ended', 'error') then
    -- (never keep the words of a question that may come from someone in distress)
    update agi1_live_questions set status = 'skipped', why = p_why, done_at = now(), reply = null,
      question = case when p_why = 'care' then '(not kept)' else question end
    where id = p_id;
  else
    return json_build_object('ok', false);
  end if;
  return json_build_object('ok', true, 'status', p_status);
end;
$$;

-- What agi1.app/live shows everyone (the same for everyone, so the CDN can share it): is she on, the show, the question on
-- air, the line (question numbers only, so each person finds their own place) and the questions finished this show.
create or replace function public.live_state_get(p_beat integer)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'on', live_on_air(s, p_beat), 'status', case when live_on_air(s, p_beat) then s.status else 'off' end,
    'show', s.show_id, 'started_at', s.started_at, 'next_at', case when s.next_at > now() then s.next_at end,
    'segment', case when live_on_air(s, p_beat) then s.segment end,
    'now', case when live_on_air(s, p_beat) then s.now_id end,
    'paused', s.paused, 'closed', s.closed,
    'waiting', coalesce((select json_agg(w.id order by w.id) from (select id from agi1_live_questions
      where status = 'waiting' order by id limit 60) w), '[]'::json),
    'done', coalesce((select json_object_agg(d.id::text, case d.status when 'answered' then 'a' else 's' end)
      from (select id, status from agi1_live_questions where status in ('answered', 'skipped') and show_id = s.show_id
            order by done_at desc nulls last limit 60) d), '{}'::json))
  from agi1_live_state s where s.id = 1;
$$;

-- The owner's controls (from the owner's link on agi1.app/live). p_action:
--   'view' (nothing changes) · 'pause' / 'resume' (her "be right back") · 'close' / 'open' (new questions) · 'end' (she
--   says goodbye and the show ends) · 'skip' (the question on air) · 'drop' (p_arg: a question's number, waiting or up next)
--   · 'clear' (everyone waiting) · 'block' / 'unblock' (p_arg: a word, 2 to 40 characters; blocking also drops the waiting
--   questions with it)
-- → what the owner's panel shows: {"ok", "status", "on", "paused", "closed", "end", "blocked", "now": {the question on air},
--   "line": [the questions waiting or up next, oldest first], "recent": [the last 10 finished]}
create or replace function public.live_control(p_action text, p_arg text, p_beat integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  s agi1_live_state%rowtype;
  word text := lower(btrim(coalesce(p_arg, '')));
  ok boolean := true;
begin
  select * into s from agi1_live_state where id = 1 for update;
  if p_action = 'pause' then update agi1_live_state set paused = true, updated_at = now() where id = 1;
  elsif p_action = 'resume' then update agi1_live_state set paused = false, updated_at = now() where id = 1;
  elsif p_action = 'close' then update agi1_live_state set closed = true, updated_at = now() where id = 1;
  elsif p_action = 'open' then update agi1_live_state set closed = false, updated_at = now() where id = 1;
  elsif p_action = 'end' then update agi1_live_state set end_asked = live_on_air(s, p_beat), updated_at = now() where id = 1;
  elsif p_action = 'skip' then
    update agi1_live_questions set status = 'skipped', why = 'owner', done_at = now()
    where id = s.now_id and status = 'taken';
    ok := found;
  elsif p_action = 'drop' then
    if p_arg !~ '^[0-9]{1,18}$' then return json_build_object('ok', false, 'why', 'bad'); end if;
    update agi1_live_questions set status = 'skipped', why = 'owner', done_at = now()
    where id = p_arg::bigint and status in ('waiting', 'taken');
    ok := found;
  elsif p_action = 'clear' then
    update agi1_live_questions set status = 'skipped', why = 'owner', done_at = now()
    where status = 'waiting' or (status = 'taken' and id is distinct from s.now_id);
  elsif p_action = 'block' then
    if char_length(word) not between 2 and 40 then return json_build_object('ok', false, 'why', 'bad'); end if;
    if not (word = any(s.blocked)) then
      if cardinality(s.blocked) >= 100 then return json_build_object('ok', false, 'why', 'full'); end if;
      update agi1_live_state set blocked = array_append(blocked, word), updated_at = now() where id = 1;
    end if;
    update agi1_live_questions set status = 'skipped', why = 'owner', done_at = now()
    where status in ('waiting', 'taken') and id is distinct from s.now_id
      and (position(word in lower(question)) > 0 or position(word in lower(coalesce(name, ''))) > 0);
  elsif p_action = 'unblock' then
    update agi1_live_state set blocked = array_remove(blocked, word), updated_at = now() where id = 1;
  elsif p_action is distinct from 'view' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  select * into s from agi1_live_state where id = 1;
  return json_build_object('ok', ok, 'status', case when live_on_air(s, p_beat) then s.status else 'off' end,
    'on', live_on_air(s, p_beat), 'paused', s.paused, 'closed', s.closed, 'end', s.end_asked, 'blocked', s.blocked,
    'show', s.show_id, 'next_at', case when s.next_at > now() then s.next_at end,
    'now', (select json_build_object('id', q.id, 'name', q.name, 'question', q.question, 'reply', q.reply, 'source', q.source)
      from agi1_live_questions q where q.id = s.now_id and q.status = 'taken'),
    'line', coalesce((select json_agg(json_build_object('id', q.id, 'name', q.name, 'question', q.question, 'source', q.source,
      'status', q.status, 'at', q.created_at) order by q.id)
      from (select * from agi1_live_questions where (status = 'waiting' or (status = 'taken' and id is distinct from s.now_id))
            order by id limit 50) q), '[]'::json),
    'recent', coalesce((select json_agg(json_build_object('id', q.id, 'name', q.name, 'question', q.question, 'status', q.status,
      'why', q.why) order by q.done_at desc)
      from (select * from agi1_live_questions where status in ('answered', 'skipped') order by done_at desc nulls last limit 10) q),
      '[]'::json));
end;
$$;

-- Tidying up (the keep-alive, 3 times a day): questions older than 2 days are deleted, and a show whose runner went quiet
-- for 10 minutes is switched off (its questions skipped, "ended"). → {"deleted": n}
create or replace function public.live_tidy()
returns json
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  delete from agi1_live_questions where created_at < now() - interval '2 days';
  get diagnostics n = row_count;
  if exists (select 1 from agi1_live_state where id = 1 and status <> 'off'
             and (beat_at is null or beat_at < now() - interval '10 minutes')) then
    update agi1_live_questions set status = 'skipped', why = 'ended', done_at = now() where status in ('waiting', 'taken');
    update agi1_live_state set status = 'off', segment = null, now_id = null, paused = false, end_asked = false, updated_at = now()
    where id = 1;
  end if;
  return json_build_object('deleted', n);
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.live_on_air(agi1_live_state, integer) from public, anon, authenticated;
revoke all on function public.live_ask(text, text, text, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.live_lookup(bigint, text) from public, anon, authenticated;
revoke all on function public.live_start(text) from public, anon, authenticated;
revoke all on function public.live_beat(bigint, text, text, bigint) from public, anon, authenticated;
revoke all on function public.live_stop(bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.live_schedule(timestamptz) from public, anon, authenticated;
revoke all on function public.live_take(bigint) from public, anon, authenticated;
revoke all on function public.live_done(bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function public.live_state_get(integer) from public, anon, authenticated;
revoke all on function public.live_control(text, text, integer) from public, anon, authenticated;
revoke all on function public.live_tidy() from public, anon, authenticated;
grant execute on function public.live_on_air(agi1_live_state, integer) to service_role;
grant execute on function public.live_ask(text, text, text, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.live_lookup(bigint, text) to service_role;
grant execute on function public.live_start(text) to service_role;
grant execute on function public.live_beat(bigint, text, text, bigint) to service_role;
grant execute on function public.live_stop(bigint, timestamptz) to service_role;
grant execute on function public.live_schedule(timestamptz) to service_role;
grant execute on function public.live_take(bigint) to service_role;
grant execute on function public.live_done(bigint, text, text, text, text) to service_role;
grant execute on function public.live_state_get(integer) to service_role;
grant execute on function public.live_control(text, text, integer) to service_role;
grant execute on function public.live_tidy() to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show live_functions_found = 12.
select count(*) as live_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('live_on_air', 'live_ask', 'live_lookup', 'live_start', 'live_beat', 'live_stop', 'live_schedule', 'live_take',
    'live_done', 'live_state_get', 'live_control', 'live_tidy');
