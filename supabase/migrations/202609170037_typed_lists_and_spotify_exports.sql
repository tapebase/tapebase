begin;

alter table public.user_lists
  add column kind text not null default 'albums'
    check (kind in ('albums', 'tracks')),
  add column spotify_playlist_id text,
  add column spotify_playlist_url text,
  add column spotify_exported_at timestamptz;

create unique index user_lists_spotify_playlist_key
  on public.user_lists (spotify_playlist_id)
  where spotify_playlist_id is not null;

create table public.user_track_list_items (
  list_id bigint not null constraint user_track_list_items_list_id_fkey references public.user_lists(id) on delete cascade,
  track_id bigint not null constraint user_track_list_items_track_id_fkey references public.tracks(id) on delete cascade,
  position integer not null check (position > 0),
  added_at timestamptz not null default now(),
  primary key (list_id, track_id),
  unique (list_id, position)
);

create index user_track_list_items_track_idx on public.user_track_list_items (track_id);

create table public.user_spotify_connections (
  user_id uuid primary key constraint user_spotify_connections_user_id_fkey references public.users(id) on delete cascade,
  spotify_user_id text not null,
  refresh_token_encrypted text not null,
  scopes text[] not null default '{}'::text[],
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_spotify_connections_set_updated_at
before update on public.user_spotify_connections
for each row execute function public.set_updated_at();

create or replace function public.enforce_user_list_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'user_lists' then
    if (select count(*) from public.user_lists where user_id = new.user_id) >= 50 then
      raise exception 'User list limit reached';
    end if;
  elsif tg_table_name = 'user_list_items' then
    if (select count(*) from public.user_list_items where list_id = new.list_id) >= 500 then
      raise exception 'List item limit reached';
    end if;
  elsif tg_table_name = 'user_track_list_items' then
    if (select count(*) from public.user_track_list_items where list_id = new.list_id) >= 500 then
      raise exception 'List item limit reached';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_user_list_item_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare expected_kind text;
begin
  expected_kind := case when tg_table_name = 'user_list_items' then 'albums' else 'tracks' end;
  if not exists (
    select 1 from public.user_lists list
    where list.id = new.list_id and list.kind = expected_kind
  ) then
    raise exception 'Wrong list kind';
  end if;
  return new;
end;
$$;

create trigger user_list_items_kind_before_insert
before insert or update on public.user_list_items
for each row execute function public.enforce_user_list_item_kind();

create trigger user_track_list_items_limit_before_insert
before insert on public.user_track_list_items
for each row execute function public.enforce_user_list_limits();

create trigger user_track_list_items_kind_before_insert
before insert or update on public.user_track_list_items
for each row execute function public.enforce_user_list_item_kind();

alter table public.user_track_list_items enable row level security;
alter table public.user_spotify_connections enable row level security;

create policy user_track_list_items_visible_read on public.user_track_list_items
for select to anon, authenticated
using (exists (
  select 1 from public.user_lists list
  where list.id = user_track_list_items.list_id
    and (list.is_public or list.user_id = (select auth.uid()))
));

create policy user_track_list_items_insert_own on public.user_track_list_items
for insert to authenticated
with check (public.is_active_user() and exists (
  select 1 from public.user_lists list
  where list.id = user_track_list_items.list_id
    and list.user_id = (select auth.uid())
    and list.kind = 'tracks'
));

create policy user_track_list_items_delete_own on public.user_track_list_items
for delete to authenticated
using (public.is_active_user() and exists (
  select 1 from public.user_lists list
  where list.id = user_track_list_items.list_id and list.user_id = (select auth.uid())
));

revoke all on public.user_track_list_items, public.user_spotify_connections from anon, authenticated;
grant select on public.user_track_list_items to anon, authenticated;
grant insert, delete on public.user_track_list_items to authenticated;

revoke all on function public.enforce_user_list_item_kind() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
