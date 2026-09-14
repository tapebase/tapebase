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
      );

    update public.artist_youtube_sync
    set status = 'pending', next_search_at = now(), last_error = null
    where artist_id = target_artist_id;
  end if;
end;
$$;

-- Undo approvals made only from an "official" marker on a shared label.
update public.artist_videos
set status = 'pending',
  is_official = false,
  confidence_score = least(confidence_score, 0.8),
  match_evidence = match_evidence - 'verifiedChannel' - 'verifiedByAdmin',
  reviewed_by = null,
  reviewed_at = null
where status = 'approved'
  and coalesce((match_evidence ->> 'verifiedByAdmin')::boolean, false)
  and not coalesce((match_evidence ->> 'artistInTitle')::boolean, false)
  and not coalesce((match_evidence ->> 'artistInChannel')::boolean, false);

notify pgrst, 'reload schema';
commit;
