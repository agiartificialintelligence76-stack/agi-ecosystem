-- AGI-1 texts first (2026-09-29, the owner's idea): her Telegram bot, and the feed of moments she texts about.
-- Run this once in the Supabase project that SUPABASE_URL points to: SQL Editor → New query → paste all of it → Run.
-- It only ADDS four new tables and their functions (all named agi1_… / tg_… / feed_…). It doesn't touch any table the
-- original site uses, so it's safe in the database both sites share. Running it again changes nothing that's saved.
--
-- What's kept, per person who pressed Start in Telegram: the chat's number (Telegram's id for that chat, needed to text
-- them; never their phone number, name or username), whether they confirmed they're 18+, the time difference they told
-- her (so she never texts at night), the newest moment she has texted them about, and how many texts she started today.
-- Never their messages. /stop in Telegram (or blocking the bot) deletes the row. Only the server (secret key) can use this.

-- The people she may text first
create table if not exists public.agi1_tg_friends (
  chat_id    bigint      primary key,
  adult      boolean     not null default false,
  tz_minutes smallint    check (tz_minutes is null or tz_minutes between -720 and 840),   -- their clock minus UTC
  seen_id    bigint      not null default 0,                                              -- newest moment texted (or skipped)
  day        date,                                                                        -- their own date of her last text…
  sent       smallint    not null default 0 check (sent between 0 and 20),               -- …and how many she started that day
  joined_at  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The moments she can text about (a new egirl coin, a copy of $AGI, $AGI's market moments, her diary): the same words
-- for everyone. `key` makes each moment happen once. Kept 30 days.
create table if not exists public.agi1_feed (
  id         bigint      generated always as identity primary key,
  kind       text        not null check (kind in ('clone', 'copy', 'mcap', 'sad', 'diary')),
  key        text        not null unique check (char_length(key) between 1 and 120),
  text       text        not null check (char_length(text) between 1 and 1200),
  created_at timestamptz not null default now()
);

-- Where the feed is (the newest coin it has seen, the $AGI market it last looked at, the last diary day): one row
create table if not exists public.agi1_feed_state (
  id         smallint    primary key default 1 check (id = 1),
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Telegram's share of the day's AI replies (so Telegram alone can't use up the website's chat): one row a day, a week kept
create table if not exists public.agi1_tg_usage (
  day date    primary key,
  n   integer not null default 0
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_tg_friends enable row level security;
alter table public.agi1_feed enable row level security;
alter table public.agi1_feed_state enable row level security;
alter table public.agi1_tg_usage enable row level security;
revoke all on table public.agi1_tg_friends from anon, authenticated;
revoke all on table public.agi1_feed from anon, authenticated;
revoke all on table public.agi1_feed_state from anon, authenticated;
revoke all on table public.agi1_tg_usage from anon, authenticated;

-- ---------- the people ----------
-- One person's row, or null
create or replace function public.tg_get(p_chat bigint)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object('chat_id', chat_id, 'adult', adult, 'tz_minutes', tz_minutes, 'seen_id', seen_id, 'day', day, 'sent', sent)
  from agi1_tg_friends where chat_id = p_chat;
$$;

-- /start: adds them (not yet 18+ confirmed) if they're new; someone already there keeps what they had
create or replace function public.tg_join(p_chat bigint)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_chat is null or p_chat <= 0 then return null; end if;          -- private chats only (groups have negative ids)
  insert into agi1_tg_friends (chat_id) values (p_chat) on conflict (chat_id) do nothing;
  return tg_get(p_chat);
end;
$$;

-- "I'm 18 or older" (p_adult) and their time (p_tz, minutes): null leaves a value as it is. Null if they aren't there.
create or replace function public.tg_set(p_chat bigint, p_adult boolean default null, p_tz integer default null)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_tz is not null and p_tz not between -720 and 840 then return tg_get(p_chat); end if;
  update agi1_tg_friends
     set adult = coalesce(p_adult, adult), tz_minutes = coalesce(p_tz, tz_minutes), updated_at = now()
   where chat_id = p_chat;
  return tg_get(p_chat);
end;
$$;

-- /stop, "I'm under 18", or they blocked the bot: forget them. True if there was a row.
create or replace function public.tg_forget(p_chat bigint)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  delete from agi1_tg_friends where chat_id = p_chat;
  return found;
end;
$$;

-- Who hasn't heard about the newest moment yet (18+ confirmed, time told), a page at a time by chat number
create or replace function public.tg_due(p_newest bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('chat_id', chat_id, 'tz_minutes', tz_minutes, 'seen_id', seen_id, 'day', day, 'sent', sent)
                           order by chat_id), '[]'::json)
  from (
    select chat_id, tz_minutes, seen_id, day, sent from agi1_tg_friends
    where adult and tz_minutes is not null and seen_id < p_newest and chat_id > coalesce(p_after, 0)
    order by chat_id
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
  ) due;
$$;

-- Before a round of texts, claim them: [{ "chat": 123, "from": 5, "seen": 9, "day": "2026-09-29", "sent": 1 }]. A row only
-- changes if its seen_id is still `from`, so two runs at once (or a run cut short) never text anyone twice. The same call
-- gives a claim back when Telegram said "too many" before that text went out (from = the claimed seen, and the old values).
-- → the chats it changed (a JSON array)
create or replace function public.tg_claim(p_rows json)
returns json
language plpgsql
set search_path = public
as $$
declare
  r json;
  got bigint;
  claimed bigint[] := '{}';
begin
  if p_rows is null or json_typeof(p_rows) <> 'array' or json_array_length(p_rows) > 1000 then return '[]'::json; end if;
  for r in select value from json_array_elements(p_rows) loop
    if json_typeof(r) <> 'object' or coalesce(r->>'chat', '') !~ '^[0-9]{1,16}$' or coalesce(r->>'from', '') !~ '^[0-9]{1,16}$'
       or coalesce(r->>'seen', '') !~ '^[0-9]{1,16}$' or coalesce(r->>'sent', '') !~ '^[0-9]{1,2}$' or (r->>'sent')::int > 20
       or ((r->>'day') is not null and (r->>'day') !~ '^\d{4}-\d{2}-\d{2}$') then
      continue;
    end if;
    update agi1_tg_friends
       set seen_id = (r->>'seen')::bigint, day = (r->>'day')::date, sent = (r->>'sent')::smallint, updated_at = now()
     where chat_id = (r->>'chat')::bigint and seen_id = (r->>'from')::bigint
    returning chat_id into got;
    if found then claimed := claimed || got; end if;
  end loop;
  return to_json(claimed);
end;
$$;

-- Telegram's own daily cap on AI replies (p_max a day, UTC): true = one more reply, counted; false = Telegram's share is used
create or replace function public.tg_take(p_max integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  used integer;
begin
  insert into agi1_tg_usage (day, n) values (today, 0) on conflict (day) do nothing;
  update agi1_tg_usage set n = n + 1 where day = today and n < greatest(0, coalesce(p_max, 0)) returning n into used;
  delete from agi1_tg_usage where day < today - 7;
  return used is not null;
end;
$$;

-- After a round of texts, for the ones Telegram said can't be delivered: [{ "chat": 123, "gone": true }] (they blocked the
-- bot or deleted their account) → forgotten. Also takes { "chat", "seen", "day", "sent" } (seen never goes back).
-- → how many rows it looked at
create or replace function public.tg_mark(p_rows json)
returns integer
language plpgsql
set search_path = public
as $$
declare
  r json;
  n integer := 0;
begin
  if p_rows is null or json_typeof(p_rows) <> 'array' or json_array_length(p_rows) > 1000 then return 0; end if;
  for r in select value from json_array_elements(p_rows) loop
    if json_typeof(r) <> 'object' or (r->>'chat') !~ '^[0-9]{1,16}$' then continue; end if;
    if (r->>'gone') = 'true' then
      delete from agi1_tg_friends where chat_id = (r->>'chat')::bigint;
    else
      update agi1_tg_friends
         set seen_id = greatest(seen_id, case when (r->>'seen') ~ '^[0-9]{1,16}$' then (r->>'seen')::bigint else seen_id end),
             day = case when (r->>'day') ~ '^\d{4}-\d{2}-\d{2}$' then (r->>'day')::date else day end,
             sent = case when (r->>'sent') ~ '^[0-9]{1,2}$' and (r->>'sent')::int <= 20 then (r->>'sent')::smallint else sent end,
             updated_at = now()
       where chat_id = (r->>'chat')::bigint;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------- the moments ----------
-- A new moment → its id, or null if that moment (its key) was already there. Also clears moments older than 30 days.
create or replace function public.feed_add(p_kind text, p_key text, p_text text)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  new_id bigint;
begin
  delete from agi1_feed where created_at < now() - interval '30 days';
  insert into agi1_feed (kind, key, text) values (p_kind, p_key, p_text)
  on conflict (key) do nothing
  returning id into new_id;
  return new_id;
end;
$$;

-- The moments of the last p_hours hours, newest first (at most 50)
create or replace function public.feed_recent(p_hours integer default 12)
returns json
language sql
stable
set search_path = public
as $$
  select coalesce(json_agg(json_build_object('id', id, 'kind', kind, 'key', key, 'text', text, 'created_at', created_at) order by id desc), '[]'::json)
  from (
    select id, kind, key, text, created_at from agi1_feed
    where created_at > now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 12), 72)))
    order by id desc
    limit 50
  ) recent;
$$;

create or replace function public.feed_state_get()
returns jsonb
language sql
stable
set search_path = public
as $$
  select state from agi1_feed_state where id = 1;
$$;

create or replace function public.feed_state_put(p_state jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' or pg_column_size(p_state) > 20000 then return false; end if;
  insert into agi1_feed_state (id, state) values (1, p_state)
  on conflict (id) do update set state = excluded.state, updated_at = now();
  return true;
end;
$$;

-- Only the server (the secret key = service_role) may call them. The browser keys may not.
revoke all on function public.tg_get(bigint) from public, anon, authenticated;
revoke all on function public.tg_join(bigint) from public, anon, authenticated;
revoke all on function public.tg_set(bigint, boolean, integer) from public, anon, authenticated;
revoke all on function public.tg_forget(bigint) from public, anon, authenticated;
revoke all on function public.tg_due(bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.tg_mark(json) from public, anon, authenticated;
revoke all on function public.tg_claim(json) from public, anon, authenticated;
revoke all on function public.tg_take(integer) from public, anon, authenticated;
revoke all on function public.feed_add(text, text, text) from public, anon, authenticated;
revoke all on function public.feed_recent(integer) from public, anon, authenticated;
revoke all on function public.feed_state_get() from public, anon, authenticated;
revoke all on function public.feed_state_put(jsonb) from public, anon, authenticated;
grant execute on function public.tg_get(bigint) to service_role;
grant execute on function public.tg_join(bigint) to service_role;
grant execute on function public.tg_set(bigint, boolean, integer) to service_role;
grant execute on function public.tg_forget(bigint) to service_role;
grant execute on function public.tg_due(bigint, bigint, integer) to service_role;
grant execute on function public.tg_mark(json) to service_role;
grant execute on function public.tg_claim(json) to service_role;
grant execute on function public.tg_take(integer) to service_role;
grant execute on function public.feed_add(text, text, text) to service_role;
grant execute on function public.feed_recent(integer) to service_role;
grant execute on function public.feed_state_get() to service_role;
grant execute on function public.feed_state_put(jsonb) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show telegram_functions_found = 12.
select count(*) as telegram_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('tg_get', 'tg_join', 'tg_set', 'tg_forget', 'tg_due', 'tg_claim', 'tg_mark', 'tg_take', 'feed_add', 'feed_recent', 'feed_state_get', 'feed_state_put');
