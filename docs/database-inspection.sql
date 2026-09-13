-- Read-only metadata inspection. Run the entire query in Supabase SQL Editor.
-- Returns ONE JSON cell, without catalog rows, user data, or credentials.
with target_tables(name) as (
  values ('artists'), ('albums'), ('tracks'), ('album_artists'), ('track_artists'), ('spotify_track_artists')
)
select jsonb_pretty(jsonb_build_object(
  'columns', (
    select jsonb_agg(to_jsonb(c) order by c.table_name,c.ordinal_position)
    from (
      select table_name,column_name,data_type,udt_name,is_nullable,column_default,
        is_identity,identity_generation,ordinal_position
      from information_schema.columns
      where table_schema='public' and table_name in (select name from target_tables)
    ) c
  ),
  'constraints', (
    select jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
      'definition',pg_get_constraintdef(c.oid)) order by r.relname,c.conname)
    from pg_constraint c join pg_class r on r.oid=c.conrelid
    join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and r.relname in (select name from target_tables)
  ),
  'indexes', (
    select jsonb_agg(to_jsonb(i)) from (
      select tablename,indexname,indexdef from pg_indexes
      where schemaname='public' and tablename in (select name from target_tables)
    ) i
  ),
  'rls', (
    select jsonb_agg(jsonb_build_object('table',r.relname,'enabled',r.relrowsecurity,'forced',r.relforcerowsecurity))
    from pg_class r join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and r.relname in (select name from target_tables)
  ),
  'policies', (
    select jsonb_agg(to_jsonb(p)) from (
      select tablename,policyname,roles,cmd,qual,with_check from pg_policies
      where schemaname='public' and tablename in (select name from target_tables)
    ) p
  ),
  'grants', (
    select jsonb_agg(to_jsonb(g)) from (
      select table_name,grantee,privilege_type from information_schema.role_table_grants
      where table_schema='public' and table_name in (select name from target_tables)
    ) g
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid)))
    from pg_trigger t join pg_class r on r.oid=t.tgrelid
    join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public' and not t.tgisinternal and r.relname in (select name from target_tables)
  )
)) as schema_report;
