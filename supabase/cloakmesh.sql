-- CloakMesh's waitlist (inference.agi1.app, 2026-10-03: the owner's private-AI project, its landing page and a free
-- waitlist). Run this once in the Supabase project that SUPABASE_URL points to, any time: SQL Editor → New query → paste
-- all of it → Run. It ends by showing cloakmesh_functions_found = 3. **Until it's run, the page says the waitlist opens
-- soon** (its form stays closed).
-- It only ADDS two new tables and three functions (all named agi1_cloakmesh… / cloakmesh_…). It doesn't touch any table
-- the original site uses, so it's safe in the database both sites share. Running it again changes nothing that's saved.
--
-- What's kept, and why:
--   agi1_cloakmesh_waitlist  one row per person: their email address (lowercase), what they'd mostly like to do (use it,
--                            build on it, run a node), the day they joined, and their leave link's secret (a random 64-
--                            character code, made here once: whoever has the link can delete the row; joining again with
--                            the same email gives the same link, and the page answers the same either way, so nobody can
--                            learn whether an address is on the list)
--   agi1_cloakmesh_days      today's and yesterday's sign-up counts: one row per visitor (a code of their internet address
--                            that changes every day, made by our server: never the address itself) and one for the whole
--                            site, for the daily limits. Older rows are deleted as new sign-ups come in
-- The email address is the only personal data, kept only to tell people about CloakMesh. Only the server (the secret key)
-- can use these tables; the owner reads the list in Supabase (Table Editor → agi1_cloakmesh_waitlist).

create table if not exists public.agi1_cloakmesh_waitlist (
  id          bigint      generated always as identity primary key,
  email       text        not null unique check (char_length(email) between 6 and 254 and email = lower(email) and position('@' in email) > 1),
  role        text        not null default 'use' check (role in ('use', 'build', 'node')),
  leave_token text        not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
                          check (leave_token ~ '^[0-9a-f]{64}$'),
  joined      date        not null default ((now() at time zone 'utc')::date)
);

create table if not exists public.agi1_cloakmesh_days (
  day date    not null,
  who text    not null check (char_length(who) between 4 and 64),     -- a visitor's daily code, or 'site'
  n   integer not null default 0 check (n >= 0),
  primary key (day, who)
);

-- Row Level Security ON, with no rules: the public (browser) keys can't read or change these tables.
alter table public.agi1_cloakmesh_waitlist enable row level security;
alter table public.agi1_cloakmesh_days enable row level security;
revoke all on table public.agi1_cloakmesh_waitlist from anon, authenticated;
revoke all on table public.agi1_cloakmesh_days from anon, authenticated;

-- "Is the waitlist set up?" (the page asks before it opens its form)
create or replace function public.cloakmesh_ready()
returns boolean
language sql
stable
set search_path = public
as $$
  select true;
$$;

-- Someone joins (our server has checked the address and the human check first).
-- p_email: the address, lowercase · p_role: 'use' | 'build' | 'node' · p_who: the visitor's code for today ·
-- p_person_daily / p_site_daily: sign-ups a day for one visitor / for the whole site (every try counts).
-- → {"ok": true, "token"} (their leave link's code: the same for an address already on the list, whose choice is updated)
--   or {"ok": false, "why": "bad" | "person_cap" | "site_cap"}
create or replace function public.cloakmesh_join(p_email text, p_role text, p_who text, p_person_daily integer, p_site_daily integer)
returns json
language plpgsql
set search_path = public
as $$
declare
  d    date := (now() at time zone 'utc')::date;
  seen integer;
  tok  text;
begin
  if p_email is null or char_length(p_email) not between 6 and 254 or p_email <> lower(p_email)
     or position('@' in p_email) < 2 or p_email ~ '[[:space:][:cntrl:]]'
     or p_role is null or p_role not in ('use', 'build', 'node')
     or p_who is null or char_length(p_who) not between 16 and 64 or p_who = 'site'
     or p_person_daily is null or p_person_daily not between 1 and 1000
     or p_site_daily is null or p_site_daily not between 1 and 1000000 then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  -- counts older than yesterday aren't needed any more
  delete from agi1_cloakmesh_days where day < d - 1;
  -- the site's count first, then the visitor's (always in this order, so two sign-ups never wait for each other in a circle)
  insert into agi1_cloakmesh_days as c (day, who, n) values (d, 'site', 1)
  on conflict (day, who) do update set n = c.n + 1
  returning c.n into seen;
  if seen > p_site_daily then return json_build_object('ok', false, 'why', 'site_cap'); end if;
  insert into agi1_cloakmesh_days as c (day, who, n) values (d, p_who, 1)
  on conflict (day, who) do update set n = c.n + 1
  returning c.n into seen;
  if seen > p_person_daily then return json_build_object('ok', false, 'why', 'person_cap'); end if;
  insert into agi1_cloakmesh_waitlist as w (email, role) values (p_email, p_role)
  on conflict (email) do update set role = excluded.role
  returning w.leave_token into tok;
  return json_build_object('ok', true, 'token', tok);
end;
$$;

-- Someone leaves, with their link's code. → {"ok": true, "removed": true | false} or {"ok": false, "why": "bad"}
create or replace function public.cloakmesh_leave(p_token text)
returns json
language plpgsql
set search_path = public
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return json_build_object('ok', false, 'why', 'bad');
  end if;
  delete from agi1_cloakmesh_waitlist where leave_token = p_token;
  return json_build_object('ok', true, 'removed', found);
end;
$$;

-- Only the server's secret key may call them.
revoke all on function public.cloakmesh_ready() from public, anon, authenticated;
revoke all on function public.cloakmesh_join(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.cloakmesh_leave(text) from public, anon, authenticated;
grant execute on function public.cloakmesh_ready() to service_role;
grant execute on function public.cloakmesh_join(text, text, text, integer, integer) to service_role;
grant execute on function public.cloakmesh_leave(text) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show cloakmesh_functions_found = 3.
select count(*) as cloakmesh_functions_found from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('cloakmesh_ready', 'cloakmesh_join', 'cloakmesh_leave');
