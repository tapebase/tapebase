begin;

alter table public.catalog_import_jobs
  add column retry_at timestamptz,
  add column worker_id uuid,
  add column locked_until timestamptz;

alter table public.catalog_import_items
  add column retry_at timestamptz,
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column last_attempt_at timestamptz;

create index catalog_import_jobs_claim_idx
  on public.catalog_import_jobs(status, retry_at, locked_until, created_at);

create or replace function public.claim_catalog_import_job(
  claim_worker uuid,
  lease_seconds integer default 300,
  max_parallel integer default 1
)
returns setof public.catalog_import_jobs
language plpgsql security definer set search_path = '' as $$
declare
  claimed_id bigint;
begin
  if claim_worker is null or lease_seconds not between 30 and 900 or max_parallel not between 1 and 4 then
    raise exception 'Invalid import claim';
  end if;

  perform pg_advisory_xact_lock(724031907);

  update public.catalog_import_items item
  set status = 'queued', error_message = coalesce(item.error_message, 'Przywrócono po przerwanym imporcie.')
  from public.catalog_import_jobs job
  where item.job_id = job.id and item.status = 'running' and job.status = 'running'
    and (job.locked_until is null or job.locked_until < now());

  update public.catalog_import_jobs
  set status = 'queued', worker_id = null, locked_until = null,
      error_message = coalesce(error_message, 'Przywrócono zadanie przerwane przez restart serwera.')
  where status = 'running' and (locked_until is null or locked_until < now());

  if (select count(*) from public.catalog_import_jobs
      where status = 'running' and locked_until >= now()) >= max_parallel then
    return;
  end if;

  select id into claimed_id
  from public.catalog_import_jobs
  where status in ('queued', 'waiting_quota')
    and (retry_at is null or retry_at <= now())
  order by created_at, id
  for update skip locked
  limit 1;

  if claimed_id is null then return; end if;

  return query
  update public.catalog_import_jobs
  set status = 'running', worker_id = claim_worker,
      locked_until = now() + make_interval(secs => lease_seconds),
      started_at = coalesce(started_at, now()), retry_at = null, error_message = null
  where id = claimed_id
  returning *;
end;
$$;

revoke all on function public.claim_catalog_import_job(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_catalog_import_job(uuid,integer,integer) to service_role;

notify pgrst, 'reload schema';
commit;
