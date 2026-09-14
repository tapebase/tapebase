begin;

create or replace function public.review_artist_youtube_channel(
  target_artist_id bigint,
  target_youtube_channel_id text,
  decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := (select auth.uid());
begin
  if admin_id is null or not public.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('verify', 'reject') then
    raise exception 'Invalid channel moderation decision';
  end if;

  update public.artist_youtube_channels
  set status = case when decision = 'verify' then 'verified' else 'rejected' end,
    reviewed_by = admin_id,
    reviewed_at = now()
  where artist_id = target_artist_id
    and youtube_channel_id = target_youtube_channel_id;
  if not found then raise exception 'Channel candidate not found'; end if;

  if decision = 'verify' then
    update public.youtube_channels
    set verification_status = 'verified'
    where youtube_channel_id = target_youtube_channel_id;

    update public.artist_videos relation
    set status = 'approved',
      is_official = true,
      confidence_score = greatest(relation.confidence_score, 0.85),
      match_evidence = relation.match_evidence || jsonb_build_object(
        'verifiedChannel', true,
        'verifiedByAdmin', true
      ),
      reviewed_by = admin_id,
      reviewed_at = now(),
      rejection_reason = null
    from public.youtube_videos video
    where relation.artist_id = target_artist_id
      and relation.youtube_video_id = video.youtube_video_id
      and video.youtube_channel_id = target_youtube_channel_id
      and relation.status = 'pending'
      and relation.matched_track_id is not null
      and (
        coalesce((relation.match_evidence ->> 'artistInTitle')::boolean, false)
        or coalesce((relation.match_evidence ->> 'artistInChannel')::boolean, false)
        or coalesce((relation.match_evidence ->> 'officialMarker')::boolean, false)
      );

    update public.artist_youtube_sync
    set status = 'pending', next_search_at = now(), last_error = null
    where artist_id = target_artist_id;
  end if;
end;
$$;

-- Apply the same safe rule to channels already verified before this behavior
-- was introduced. Rejected and manually reviewed videos are never changed.
update public.artist_videos relation
set status = 'approved',
  is_official = true,
  confidence_score = greatest(relation.confidence_score, 0.85),
  match_evidence = relation.match_evidence || jsonb_build_object(
    'verifiedChannel', true,
    'verifiedByAdmin', association.reviewed_by is not null
  ),
  reviewed_by = coalesce(relation.reviewed_by, association.reviewed_by),
  reviewed_at = coalesce(relation.reviewed_at, association.reviewed_at, now()),
  rejection_reason = null
from public.youtube_videos video,
  public.artist_youtube_channels association
where relation.youtube_video_id = video.youtube_video_id
  and association.artist_id = relation.artist_id
  and association.youtube_channel_id = video.youtube_channel_id
  and association.status = 'verified'
  and relation.status = 'pending'
  and relation.matched_track_id is not null
  and (
    coalesce((relation.match_evidence ->> 'artistInTitle')::boolean, false)
    or coalesce((relation.match_evidence ->> 'artistInChannel')::boolean, false)
    or coalesce((relation.match_evidence ->> 'officialMarker')::boolean, false)
  );

notify pgrst, 'reload schema';
commit;
