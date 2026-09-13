begin;

alter table public.comments
  add column parent_comment_id bigint references public.comments(id) on delete set null;

create index comments_parent_comment_id_idx
  on public.comments (parent_comment_id, created_at, id);

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
      and parent.album_id = new.album_id
  ) then
    raise exception 'Reply parent must belong to the same album';
  end if;

  return new;
end;
$$;

create trigger comments_validate_parent
before insert or update of parent_comment_id, album_id on public.comments
for each row execute function public.validate_comment_parent();

-- The application only edits comment text. Prevent API clients from changing
-- ownership, album or thread structure after insertion.
revoke update on public.comments from authenticated;
grant update (content) on public.comments to authenticated;

revoke all on function public.validate_comment_parent() from public, anon, authenticated;

commit;
