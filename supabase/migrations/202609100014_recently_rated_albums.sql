begin;

create index ratings_updated_at_album_id_idx
  on public.ratings(updated_at desc, album_id);

create view public.recent_album_rating_summary
with (security_invoker = true)
as
select
  recent.album_id,
  count(*)::bigint as recent_rating_count,
  summary.average,
  summary.rating_count
from public.ratings recent
join public.album_rating_summary summary on summary.album_id = recent.album_id
where recent.updated_at >= now() - interval '7 days'
group by recent.album_id, summary.average, summary.rating_count;

grant select on public.recent_album_rating_summary to anon, authenticated;

notify pgrst, 'reload schema';

commit;
