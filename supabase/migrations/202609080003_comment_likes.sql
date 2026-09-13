begin;

create table public.comment_likes (
  user_id uuid not null references public.users(id) on delete cascade,
  comment_id bigint not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_id_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy comment_likes_public_read on public.comment_likes
for select to anon, authenticated using (true);

create policy comment_likes_insert_own on public.comment_likes
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.comments
    where comments.id = comment_id
      and comments.user_id <> (select auth.uid())
  )
);

create policy comment_likes_delete_own on public.comment_likes
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.comment_likes from anon, authenticated;
grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;

create view public.album_rating_summary
with (security_invoker = true)
as
select
  album_id,
  round(avg(rating), 1) as average,
  count(*)::bigint as rating_count
from public.ratings
group by album_id;

grant select on public.album_rating_summary to anon, authenticated;

commit;
