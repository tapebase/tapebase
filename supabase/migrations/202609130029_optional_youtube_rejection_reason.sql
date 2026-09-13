begin;

alter table public.artist_videos
  drop constraint if exists artist_videos_check;

create or replace function public.review_artist_youtube_video(
  target_artist_id bigint,
  target_youtube_video_id text,
  decision text,
  official boolean default false,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := (select auth.uid());
  normalized_reason text := nullif(btrim(reason), '');
begin
  if admin_id is null or not public.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approve', 'reject') then
    raise exception 'Invalid video moderation decision';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception 'Rejection reason is too long';
  end if;

  update public.artist_videos
  set status = case when decision = 'approve' then 'approved' else 'rejected' end,
    is_official = case when decision = 'approve' then official else false end,
    rejection_reason = case when decision = 'reject' then normalized_reason else null end,
    reviewed_by = admin_id,
    reviewed_at = now()
  where artist_id = target_artist_id
    and youtube_video_id = target_youtube_video_id;
  if not found then raise exception 'Video candidate not found'; end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
