-- $AGI: AGI-1's recorded lines (2026-09-26). Run this once in the SAME Supabase project (any time; it needs nothing else):
-- SQL Editor → New query → paste all of it → Run. It ends by showing voice_line_functions_found = 2.
-- Her fixed lines ("hi, it's me", the out-of-messages lines, "come back tomorrow", the sad market lines) are the same words
-- for everyone. Google's speech model makes each one once; the server keeps the recording here, so after that she never
-- needs Google (or its daily limit) for them again, not even after a new deployment. About 1 MB in all. Nothing personal.
-- Until this is run, everything still works: the lines are simply made again by Google after each deployment.

create table if not exists public.voice_lines (
  id text not null,           -- which line + a fingerprint of its words, style, voice and model (e.g. "more-1-3f2a9c1b0d4e5f67")
  take text not null,         -- one recording; a line made twice at the same moment is two takes, the newest whole one wins
  part int not null,          -- a recording is saved in parts (base64, at most 250,000 characters each)
  parts int not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (id, take, part)
);
-- Only the server's secret key may use it (no rules = no access for the browser keys).
alter table public.voice_lines enable row level security;
revoke all on table public.voice_lines from anon, authenticated;

-- Save one part of a recording. Answers 'ok', or 'bad' (wrong input). When a take is whole, older takes of that line go.
create or replace function public.voice_line_put(p_id text, p_take text, p_part int, p_parts int, p_data text)
returns text
language plpgsql
set search_path = public
as $$
begin
  if p_id is null or p_id !~ '^[a-z0-9-]{1,64}$' or p_take is null or p_take !~ '^[a-z0-9]{1,16}$'
     or p_parts is null or p_parts < 1 or p_parts > 40 or p_part is null or p_part < 0 or p_part >= p_parts
     or p_data is null or length(p_data) < 1 or length(p_data) > 250000 or p_data !~ '^[A-Za-z0-9+/=]+$' then
    return 'bad';
  end if;
  insert into voice_lines (id, take, part, parts, data) values (p_id, p_take, p_part, p_parts, p_data)
  on conflict (id, take, part) do update set parts = excluded.parts, data = excluded.data, created_at = now();
  if (select count(*) from voice_lines where id = p_id and take = p_take and parts = p_parts) = p_parts then
    delete from voice_lines where id = p_id and take <> p_take;
  end if;
  return 'ok';
end;
$$;

-- A whole recording (its parts joined, base64), or null if there's none yet (or only a half-saved one).
create or replace function public.voice_line_get(p_id text)
returns text
language sql
stable
set search_path = public
as $$
  with whole as (
    select take, max(created_at) as at
    from voice_lines
    where id = p_id
    group by take
    having count(*) = min(parts) and min(parts) = max(parts)
    order by max(created_at) desc
    limit 1
  )
  select string_agg(v.data, '' order by v.part)
  from voice_lines v join whole w on w.take = v.take
  where v.id = p_id;
$$;

revoke all on function public.voice_line_put(text, text, int, int, text) from public, anon, authenticated;
revoke all on function public.voice_line_get(text) from public, anon, authenticated;
grant execute on function public.voice_line_put(text, text, int, int, text) to service_role;
grant execute on function public.voice_line_get(text) to service_role;

-- Tell Supabase's web API to notice the new functions right away.
notify pgrst, 'reload schema';

-- Check: this should show voice_line_functions_found = 2.
select count(*) as voice_line_functions_found from pg_proc where proname in ('voice_line_get', 'voice_line_put');
