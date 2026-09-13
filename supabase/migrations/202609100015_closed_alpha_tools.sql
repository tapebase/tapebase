begin;

alter table public.users
  add column suspended_at timestamptz,
  add column suspension_reason text check (suspension_reason is null or char_length(btrim(suspension_reason)) between 1 and 500),
  add column onboarding_completed_at timestamptz;

update public.users set onboarding_completed_at = now();

create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin' and suspended_at is null
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and suspended_at is null
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

drop policy users_update_own on public.users;
create policy users_update_own on public.users for update to authenticated
using ((select auth.uid()) = id and public.is_active_user())
with check ((select auth.uid()) = id and public.is_active_user());

drop policy ratings_insert_own on public.ratings;
drop policy ratings_update_own on public.ratings;
drop policy ratings_delete_own on public.ratings;
create policy ratings_insert_own on public.ratings for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy ratings_update_own on public.ratings for update to authenticated
using ((select auth.uid()) = user_id and public.is_active_user())
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy ratings_delete_own on public.ratings for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

drop policy artist_ratings_insert_own on public.artist_ratings;
drop policy artist_ratings_update_own on public.artist_ratings;
drop policy artist_ratings_delete_own on public.artist_ratings;
create policy artist_ratings_insert_own on public.artist_ratings for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy artist_ratings_update_own on public.artist_ratings for update to authenticated
using ((select auth.uid()) = user_id and public.is_active_user())
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy artist_ratings_delete_own on public.artist_ratings for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

alter table public.comments
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.users(id) on delete set null,
  add column hidden_reason text check (hidden_reason is null or char_length(btrim(hidden_reason)) between 1 and 500);

drop policy comments_public_read on public.comments;
drop policy comments_insert_own on public.comments;
drop policy comments_update_own on public.comments;
drop policy comments_delete_own on public.comments;
create policy comments_public_read on public.comments for select to anon, authenticated
using (hidden_at is null);
create policy comments_owner_hidden_read on public.comments for select to authenticated
using ((select auth.uid()) = user_id);
create policy comments_admin_hidden_read on public.comments for select to authenticated
using (public.is_catalog_admin());
create policy comments_insert_own on public.comments for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy comments_update_own on public.comments for update to authenticated
using ((select auth.uid()) = user_id and public.is_active_user())
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy comments_delete_own on public.comments for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

drop policy comment_likes_insert_own on public.comment_likes;
drop policy comment_likes_delete_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes for insert to authenticated
with check (
  (select auth.uid()) = user_id and public.is_active_user()
  and exists (select 1 from public.comments where comments.id = comment_id
    and comments.user_id <> (select auth.uid()) and comments.hidden_at is null)
);
create policy comment_likes_delete_own on public.comment_likes for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

drop policy listened_insert_own on public.listened;
drop policy listened_delete_own on public.listened;
create policy listened_insert_own on public.listened for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy listened_delete_own on public.listened for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

drop policy want_to_listen_insert_own on public.want_to_listen;
drop policy want_to_listen_delete_own on public.want_to_listen;
create policy want_to_listen_insert_own on public.want_to_listen for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_active_user());
create policy want_to_listen_delete_own on public.want_to_listen for delete to authenticated
using ((select auth.uid()) = user_id and public.is_active_user());

drop policy avatars_insert_own on storage.objects;
drop policy avatars_update_own on storage.objects;
drop policy avatars_delete_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user())
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active_user());

create table public.user_feedback (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 5 and 3000),
  page_url text check (page_url is null or char_length(page_url) <= 2000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  admin_id uuid references public.users(id) on delete set null,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_feedback_status_created_idx on public.user_feedback(status, created_at desc);
create trigger user_feedback_set_updated_at before update on public.user_feedback
for each row execute function public.set_updated_at();
alter table public.user_feedback enable row level security;
create policy user_feedback_insert_own on public.user_feedback for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_user());
create policy user_feedback_read_own_or_admin on public.user_feedback for select to authenticated
using (user_id = (select auth.uid()) or public.is_catalog_admin());
create policy user_feedback_admin_update on public.user_feedback for update to authenticated
using (public.is_catalog_admin()) with check (public.is_catalog_admin());
revoke all on public.user_feedback from anon, authenticated;
grant select, insert on public.user_feedback to authenticated;
grant update (status, admin_id, admin_note) on public.user_feedback to authenticated;
grant usage, select on sequence public.user_feedback_id_seq to authenticated;

create table public.comment_reports (
  id bigint generated by default as identity primary key,
  comment_id bigint not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('spam', 'abuse', 'spoiler', 'other')),
  details text check (details is null or char_length(btrim(details)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
create index comment_reports_status_created_idx on public.comment_reports(status, created_at desc);
alter table public.comment_reports enable row level security;
create policy comment_reports_read_own_or_admin on public.comment_reports for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_catalog_admin());
create policy comment_reports_admin_update on public.comment_reports for update to authenticated
using (public.is_catalog_admin()) with check (public.is_catalog_admin());
revoke all on public.comment_reports from anon, authenticated;
grant select on public.comment_reports to authenticated;
grant update (status, resolved_by, resolved_at) on public.comment_reports to authenticated;

create or replace function public.report_comment(target_comment_id bigint, report_category text, report_details text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  viewer_id uuid := (select auth.uid());
  report_id bigint;
begin
  if viewer_id is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  if report_category not in ('spam', 'abuse', 'spoiler', 'other')
    or (report_details is not null and char_length(btrim(report_details)) not between 1 and 1000) then
    raise exception 'Invalid report';
  end if;
  if not exists (select 1 from public.comments where id = target_comment_id and user_id <> viewer_id and hidden_at is null) then
    raise exception 'Comment cannot be reported';
  end if;
  insert into public.comment_reports (comment_id, reporter_id, category, details)
  values (target_comment_id, viewer_id, report_category, nullif(btrim(report_details), ''))
  on conflict (comment_id, reporter_id) do update set
    category = excluded.category, details = excluded.details, status = 'open', resolved_by = null, resolved_at = null
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.moderate_comment(target_comment_id bigint, moderation_action text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare viewer_id uuid := (select auth.uid());
begin
  if not public.is_catalog_admin() then raise exception 'Administrator required'; end if;
  if moderation_action = 'hide' then
    if reason is null or char_length(btrim(reason)) not between 1 and 500 then raise exception 'Reason required'; end if;
    update public.comments set hidden_at = now(), hidden_by = viewer_id, hidden_reason = btrim(reason)
    where id = target_comment_id;
    update public.comment_reports set status = 'reviewed', resolved_by = viewer_id, resolved_at = now()
    where comment_id = target_comment_id and status = 'open';
  elsif moderation_action = 'restore' then
    update public.comments set hidden_at = null, hidden_by = null, hidden_reason = null
    where id = target_comment_id;
  else
    raise exception 'Invalid moderation action';
  end if;
end;
$$;

create or replace function public.dismiss_comment_report(target_report_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_catalog_admin() then raise exception 'Administrator required'; end if;
  update public.comment_reports set status = 'dismissed', resolved_by = (select auth.uid()), resolved_at = now()
  where id = target_report_id;
end;
$$;

revoke all on function public.report_comment(bigint,text,text) from public, anon;
revoke all on function public.moderate_comment(bigint,text,text) from public, anon;
revoke all on function public.dismiss_comment_report(bigint) from public, anon;
grant execute on function public.report_comment(bigint,text,text) to authenticated;
grant execute on function public.moderate_comment(bigint,text,text) to authenticated;
grant execute on function public.dismiss_comment_report(bigint) to authenticated;

alter table public.notifications
  add column comment_id bigint references public.comments(id) on delete cascade,
  add column actor_id uuid references public.users(id) on delete cascade;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('submission_approved', 'submission_imported', 'submission_rejected', 'comment_reply', 'comment_like'));
alter table public.notifications add constraint notifications_target_check check (
  (kind like 'submission_%' and submission_id is not null and comment_id is null and actor_id is null)
  or (kind in ('comment_reply', 'comment_like') and submission_id is null and comment_id is not null and actor_id is not null)
);
create unique index notifications_comment_reply_unique
  on public.notifications(user_id, comment_id, kind) where kind = 'comment_reply';
create unique index notifications_comment_like_unique
  on public.notifications(user_id, comment_id, actor_id, kind) where kind = 'comment_like';

create or replace function public.notify_comment_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_user uuid; actor_name text; album_title text;
begin
  if new.parent_comment_id is null then return new; end if;
  select user_id into target_user from public.comments where id = new.parent_comment_id;
  if target_user is null or target_user = new.user_id then return new; end if;
  select username into actor_name from public.users where id = new.user_id;
  select title into album_title from public.albums where id = new.album_id;
  insert into public.notifications(user_id, comment_id, actor_id, kind, message)
  values (target_user, new.id, new.user_id, 'comment_reply',
    '@' || coalesce(actor_name, 'Użytkownik') || ' odpowiedział na Twój komentarz pod albumem „' || coalesce(album_title, 'Album') || '”.')
  on conflict do nothing;
  return new;
end;
$$;
create trigger comments_notify_reply after insert on public.comments
for each row execute function public.notify_comment_reply();

create or replace function public.notify_comment_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_user uuid; actor_name text; album_title text;
begin
  select comment.user_id, profile.username, album.title
  into target_user, actor_name, album_title
  from public.comments comment
  join public.users profile on profile.id = new.user_id
  join public.albums album on album.id = comment.album_id
  where comment.id = new.comment_id;
  if target_user is null or target_user = new.user_id then return new; end if;
  insert into public.notifications(user_id, comment_id, actor_id, kind, message)
  values (target_user, new.comment_id, new.user_id, 'comment_like',
    '@' || coalesce(actor_name, 'Użytkownik') || ' polubił Twój komentarz pod albumem „' || coalesce(album_title, 'Album') || '”.')
  on conflict do nothing;
  return new;
end;
$$;
create trigger comment_likes_notify after insert on public.comment_likes
for each row execute function public.notify_comment_like();

create or replace function public.remove_comment_like_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
  where kind = 'comment_like' and comment_id = old.comment_id and actor_id = old.user_id;
  return old;
end;
$$;
create trigger comment_likes_remove_notification after delete on public.comment_likes
for each row execute function public.remove_comment_like_notification();

revoke all on function public.notify_comment_reply() from public, anon, authenticated;
revoke all on function public.notify_comment_like() from public, anon, authenticated;
revoke all on function public.remove_comment_like_notification() from public, anon, authenticated;

create or replace function public.admin_update_user(target_user_id uuid, requested_role text, suspend_account boolean, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare viewer_id uuid := (select auth.uid());
begin
  if not public.is_catalog_admin() then raise exception 'Administrator required'; end if;
  if requested_role not in ('user', 'admin', 'verified_artist', 'verified_producer') then raise exception 'Invalid role'; end if;
  if target_user_id = viewer_id and (suspend_account or requested_role <> 'admin') then
    raise exception 'Administrator cannot block or demote own account';
  end if;
  update public.users set
    role = requested_role,
    suspended_at = case when suspend_account then coalesce(suspended_at, now()) else null end,
    suspension_reason = case when suspend_account then coalesce(nullif(btrim(reason), ''), 'Zawieszone przez administratora') else null end
  where id = target_user_id;
  if not found then raise exception 'User not found'; end if;
end;
$$;
revoke all on function public.admin_update_user(uuid,text,boolean,text) from public, anon;
grant execute on function public.admin_update_user(uuid,text,boolean,text) to authenticated;

grant update (username, avatar_url, onboarding_completed_at) on public.users to authenticated;

create or replace function public.submit_spotify_catalog_item(
  item_type text, item_id text, item_title text, item_thumbnail_url text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  viewer_id uuid := (select auth.uid());
  v_submission_id bigint;
  already_supported boolean;
begin
  if viewer_id is null or not public.is_active_user() then raise exception 'Active account required'; end if;
  if item_type not in ('artist', 'album') or item_id !~ '^[A-Za-z0-9]{22}$'
    or char_length(btrim(item_title)) not between 1 and 300
    or (item_thumbnail_url is not null and item_thumbnail_url !~ '^https://i\.scdn\.co/') then
    raise exception 'Invalid Spotify submission';
  end if;
  if exists (select 1 from public.catalog_submissions
    where spotify_type = item_type and spotify_id = item_id and status = 'imported') then
    raise exception 'Catalog item already exists';
  end if;
  insert into public.catalog_submissions (spotify_type, spotify_id, spotify_url, title, thumbnail_url, release_kind)
  values (item_type, item_id, 'https://open.spotify.com/' || item_type || '/' || item_id,
    btrim(item_title), item_thumbnail_url, case when item_type='album' then 'album' else null end)
  on conflict (spotify_type, spotify_id) do update set
    title = excluded.title,
    thumbnail_url = coalesce(excluded.thumbnail_url, public.catalog_submissions.thumbnail_url),
    status = case when public.catalog_submissions.status='rejected' then 'pending' else public.catalog_submissions.status end,
    moderator_id = case when public.catalog_submissions.status='rejected' then null else public.catalog_submissions.moderator_id end,
    moderator_note = case when public.catalog_submissions.status='rejected' then null else public.catalog_submissions.moderator_note end,
    rejection_reason = case when public.catalog_submissions.status='rejected' then null else public.catalog_submissions.rejection_reason end,
    moderated_at = case when public.catalog_submissions.status='rejected' then null else public.catalog_submissions.moderated_at end
  returning id into v_submission_id;
  select exists (select 1 from public.catalog_submission_supporters
    where submission_id = v_submission_id and user_id = viewer_id) into already_supported;
  if not already_supported and (select count(*) from public.catalog_submission_supporters
    where user_id = viewer_id and created_at >= now() - interval '24 hours') >= 10 then
    raise exception 'Daily submission limit reached';
  end if;
  insert into public.catalog_submission_supporters(submission_id,user_id)
  values(v_submission_id,viewer_id) on conflict do nothing;
  return jsonb_build_object('id',v_submission_id,'already_supported',already_supported);
end;
$$;

notify pgrst, 'reload schema';
commit;
