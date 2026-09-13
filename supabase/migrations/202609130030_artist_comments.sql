begin;

alter table public.comments
  alter column album_id drop not null,
  add column artist_id bigint references public.artists(id) on delete cascade;

alter table public.comments
  add constraint comments_single_target_check check (
    (album_id is not null and artist_id is null)
    or (album_id is null and artist_id is not null)
  );

create index comments_artist_created_idx
  on public.comments (artist_id, created_at desc)
  where artist_id is not null;

drop trigger comments_validate_parent on public.comments;

create or replace function public.validate_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_comment_id is null then
    return new;
  end if;
  if new.parent_comment_id = new.id then
    raise exception 'A comment cannot reply to itself';
  end if;
  if not exists (
    select 1 from public.comments parent
    where parent.id = new.parent_comment_id
      and parent.album_id is not distinct from new.album_id
      and parent.artist_id is not distinct from new.artist_id
  ) then
    raise exception 'Reply parent must belong to the same target';
  end if;
  return new;
end;
$$;

create trigger comments_validate_parent
before insert or update of parent_comment_id, album_id, artist_id on public.comments
for each row execute function public.validate_comment_parent();

create or replace function public.notify_comment_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_user uuid; actor_name text; target_name text; target_kind text;
begin
  if new.parent_comment_id is null then return new; end if;
  select user_id into target_user from public.comments where id = new.parent_comment_id;
  if target_user is null or target_user = new.user_id then return new; end if;
  select username into actor_name from public.users where id = new.user_id;
  if new.album_id is not null then
    select title into target_name from public.albums where id = new.album_id;
    target_kind := 'albumem';
  else
    select name into target_name from public.artists where id = new.artist_id;
    target_kind := 'artystą';
  end if;
  insert into public.notifications(user_id, comment_id, actor_id, kind, message)
  values (target_user, new.id, new.user_id, 'comment_reply',
    '@' || coalesce(actor_name, 'Użytkownik') || ' odpowiedział na Twój komentarz pod ' || target_kind || ' „' || coalesce(target_name, 'TAPEBASE') || '”.')
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.notify_comment_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_user uuid; actor_name text; target_name text; target_kind text; album_target bigint; artist_target bigint;
begin
  select comment.user_id, profile.username, comment.album_id, comment.artist_id
  into target_user, actor_name, album_target, artist_target
  from public.comments comment
  join public.users profile on profile.id = new.user_id
  where comment.id = new.comment_id;
  if target_user is null or target_user = new.user_id then return new; end if;
  if album_target is not null then
    select title into target_name from public.albums where id = album_target;
    target_kind := 'albumem';
  else
    select name into target_name from public.artists where id = artist_target;
    target_kind := 'artystą';
  end if;
  insert into public.notifications(user_id, comment_id, actor_id, kind, message)
  values (target_user, new.comment_id, new.user_id, 'comment_like',
    '@' || coalesce(actor_name, 'Użytkownik') || ' polubił Twój komentarz pod ' || target_kind || ' „' || coalesce(target_name, 'TAPEBASE') || '”.')
  on conflict do nothing;
  return new;
end;
$$;

-- The application may edit only the comment body. Target and thread ownership
-- stay immutable after creation.
revoke update on public.comments from authenticated;
grant update (content) on public.comments to authenticated;

notify pgrst, 'reload schema';
commit;
