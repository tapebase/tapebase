begin;

-- Spotify export metadata is written only by the trusted backend after Spotify
-- confirms the operation. Users may still create lists and edit visible fields.
revoke insert, update on public.user_lists from authenticated;
grant insert (user_id, name, description, is_public, kind) on public.user_lists to authenticated;
grant update (name, description, is_public) on public.user_lists to authenticated;

notify pgrst, 'reload schema';
commit;
