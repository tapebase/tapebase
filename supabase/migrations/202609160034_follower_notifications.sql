begin;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'submission_approved', 'submission_imported', 'submission_rejected',
    'comment_reply', 'comment_like', 'new_follower'
  ));

alter table public.notifications drop constraint notifications_target_check;
alter table public.notifications add constraint notifications_target_check check (
  (kind like 'submission_%' and submission_id is not null and comment_id is null and actor_id is null)
  or (kind in ('comment_reply', 'comment_like') and submission_id is null and comment_id is not null and actor_id is not null)
  or (kind = 'new_follower' and submission_id is null and comment_id is null and actor_id is not null)
);

create unique index notifications_new_follower_unique
  on public.notifications(user_id, actor_id, kind) where kind = 'new_follower';

create or replace function public.notify_new_follower()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_name text;
begin
  select username into actor_name from public.users where id = new.follower_id;
  insert into public.notifications (user_id, actor_id, kind, message)
  values (new.followed_id, new.follower_id, 'new_follower',
    '@' || coalesce(actor_name, 'Użytkownik') || ' zaczął Cię obserwować.')
  on conflict (user_id, actor_id, kind) where kind = 'new_follower'
  do update set message = excluded.message, read_at = null, created_at = now();
  return new;
end;
$$;

create trigger user_follows_notify_after_insert after insert on public.user_follows
for each row execute function public.notify_new_follower();

revoke all on function public.notify_new_follower() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
