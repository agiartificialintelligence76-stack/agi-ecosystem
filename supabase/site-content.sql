-- agi1.app/owner: isolated site content, optimistic saves and 30 recoverable versions.
-- Only the server's secret role may use these functions. The server verifies the same
-- signed owner-wallet session as /vote/owner before every private read or write.
begin;
create table if not exists public.agi_site_content (
  site text primary key check (site = 'agi1.app'),
  revision bigint not null default 0 check (revision >= 0),
  document jsonb not null default '{"pages":[],"edits":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(document) = 'object' and jsonb_typeof(document->'pages') = 'array' and jsonb_typeof(document->'edits') = 'array')
);
create table if not exists public.agi_site_content_history (
  site text not null references public.agi_site_content(site),
  revision bigint not null check (revision >= 0),
  document jsonb not null,
  updated_at timestamptz not null,
  summary text not null,
  primary key (site, revision)
);
alter table public.agi_site_content enable row level security;
alter table public.agi_site_content_history enable row level security;
revoke all on public.agi_site_content, public.agi_site_content_history from public, anon, authenticated;
grant select, insert, update, delete on public.agi_site_content, public.agi_site_content_history to service_role;
insert into public.agi_site_content(site) values ('agi1.app') on conflict (site) do nothing;
insert into public.agi_site_content_history(site, revision, document, updated_at, summary)
select site, revision, document, updated_at, 'Original site' from public.agi_site_content where site = 'agi1.app'
on conflict (site, revision) do nothing;

create or replace function public.site_content_get()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('document', document, 'revision', revision, 'updatedAt', updated_at)
  from public.agi_site_content where site = 'agi1.app';
$$;

create or replace function public.site_content_history()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('revision', revision, 'updatedAt', updated_at, 'summary', summary) order by revision desc), '[]'::jsonb)
  from (select revision, updated_at, summary from public.agi_site_content_history where site = 'agi1.app' order by revision desc limit 30) h;
$$;

create or replace function public.site_content_put(p_revision bigint, p_document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.agi_site_content%rowtype; saved_at timestamptz := clock_timestamp();
begin
  if p_revision is null or p_revision < 0 or p_document is null
    or jsonb_typeof(p_document) <> 'object' or jsonb_typeof(p_document->'pages') is distinct from 'array'
    or jsonb_typeof(p_document->'edits') is distinct from 'array'
    or octet_length(p_document::text) > 400000 then
    return jsonb_build_object('ok', false, 'why', 'bad');
  end if;
  if jsonb_array_length(p_document->'pages') > 150 or jsonb_array_length(p_document->'edits') > 1500 then
    return jsonb_build_object('ok', false, 'why', 'bad');
  end if;
  select * into strict current_row from public.agi_site_content where site = 'agi1.app' for update;
  if current_row.revision <> p_revision then
    return jsonb_build_object('ok', false, 'why', 'conflict', 'revision', current_row.revision);
  end if;
  update public.agi_site_content set document = p_document, revision = current_row.revision + 1, updated_at = saved_at where site = 'agi1.app';
  insert into public.agi_site_content_history(site, revision, document, updated_at, summary)
    values ('agi1.app', current_row.revision + 1, p_document, saved_at,
      jsonb_array_length(p_document->'pages') || ' page settings · ' || jsonb_array_length(p_document->'edits') || ' element changes');
  delete from public.agi_site_content_history where site = 'agi1.app' and revision not in (
    select revision from public.agi_site_content_history where site = 'agi1.app' order by revision desc limit 30
  );
  return jsonb_build_object('ok', true, 'document', p_document, 'revision', current_row.revision + 1, 'updatedAt', saved_at);
end;
$$;

create or replace function public.site_content_restore(p_revision bigint, p_target bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; target_document jsonb; result jsonb;
begin
  select revision into strict current_revision from public.agi_site_content where site = 'agi1.app' for update;
  if p_revision is distinct from current_revision then
    return jsonb_build_object('ok', false, 'why', 'conflict', 'revision', current_revision);
  end if;
  select document into target_document from public.agi_site_content_history where site = 'agi1.app' and revision = p_target;
  if not found then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  result := public.site_content_put(p_revision, target_document);
  if result->>'ok' = 'true' then
    update public.agi_site_content_history set summary = 'Restored version ' || p_target where site = 'agi1.app' and revision = current_revision + 1;
  end if;
  return result;
end;
$$;

revoke all on function public.site_content_get(), public.site_content_history(), public.site_content_put(bigint,jsonb), public.site_content_restore(bigint,bigint) from public, anon, authenticated;
grant execute on function public.site_content_get(), public.site_content_history(), public.site_content_put(bigint,jsonb), public.site_content_restore(bigint,bigint) to service_role;
commit;
select count(*) as site_content_functions_found from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('site_content_get','site_content_history','site_content_put','site_content_restore');
