import "server-only";

import { catalogClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export type UserListKind = "albums" | "tracks";
export type UserListAlbum = { id: number; title: string; slug: string; cover_url: string | null };
export type UserListTrack = {
  id: number; title: string; spotify_id: string | null; album: UserListAlbum | null;
  credits: { position: number; artist: { id: number; name: string | null; slug: string | null } | null }[];
};
export type UserListAlbumItem = { added_at: string; album: UserListAlbum };
export type UserListTrackItem = { added_at: string; position: number; track: UserListTrack };

export type UserList = {
  id: number; user_id: string; name: string; description: string | null; is_public: boolean;
  kind: UserListKind; spotify_playlist_id: string | null; spotify_playlist_url: string | null;
  spotify_exported_at: string | null; created_at: string; updated_at: string;
  owner: { username: string; avatar_url: string | null } | null;
  albumItems: UserListAlbumItem[]; trackItems: UserListTrackItem[];
};

export type UserListChoice = { id: number; name: string; is_public: boolean; containsItem: boolean };
type Related<T> = T | T[] | null;
type RawAlbumItem = { added_at: string; album: Related<UserListAlbum> };
type RawTrack = Omit<UserListTrack, "album" | "credits"> & {
  album: Related<UserListAlbum>;
  credits: { position: number; artist: Related<{ id: number; name: string | null; slug: string | null }> }[] | null;
};
type RawTrackItem = { added_at: string; position: number; track: Related<RawTrack> };
type RawList = Omit<UserList, "owner" | "albumItems" | "trackItems"> & {
  owner: Related<{ username: string; avatar_url: string | null }>;
  albumItems: RawAlbumItem[] | null; trackItems: RawTrackItem[] | null;
};

const listFields = "id,user_id,name,description,is_public,kind,spotify_playlist_id,spotify_playlist_url,spotify_exported_at,created_at,updated_at,owner:users!user_lists_user_id_fkey(username,avatar_url),albumItems:user_list_items(added_at,album:albums(id,title,slug,cover_url)),trackItems:user_track_list_items(added_at,position,track:tracks(id,title,spotify_id,album:albums(id,title,slug,cover_url),credits:spotify_track_artists(position,artist:artists(id,name,slug))))";

function one<T>(value: Related<T>) { return Array.isArray(value) ? value[0] ?? null : value; }

function normalizeList(row: RawList): UserList {
  const albumItems = (row.albumItems ?? []).flatMap(item => {
    const album = one(item.album);
    return album ? [{ added_at: item.added_at, album }] : [];
  }).sort((a, b) => b.added_at.localeCompare(a.added_at));
  const trackItems = (row.trackItems ?? []).flatMap(item => {
    const track = one(item.track);
    if (!track) return [];
    return [{
      added_at: item.added_at, position: item.position,
      track: {
        ...track, album: one(track.album),
        credits: (track.credits ?? []).flatMap(credit => {
          const artist = one(credit.artist);
          return artist ? [{ position: credit.position, artist }] : [];
        }).sort((a, b) => a.position - b.position),
      },
    }];
  }).sort((a, b) => a.position - b.position);
  return { ...row, owner: one(row.owner), albumItems, trackItems };
}

async function listsForUser(userId: string, publicOnly: boolean) {
  const client = publicOnly ? catalogClient() : await createClient();
  let query = client.from("user_lists").select(listFields).eq("user_id", userId);
  if (publicOnly) query = query.eq("is_public", true);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(publicOnly ? "Nie udało się pobrać publicznych list." : "Nie udało się pobrać Twoich list.");
  return ((data ?? []) as unknown as RawList[]).map(normalizeList);
}

export function getOwnUserLists(userId: string) { return listsForUser(userId, false); }
export function getPublicUserLists(userId: string) { return listsForUser(userId, true); }

export async function getUserListById(id: number, signedIn: boolean) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const client = signedIn ? await createClient() : catalogClient();
  const { data, error } = await client.from("user_lists").select(listFields).eq("id", id).maybeSingle();
  if (error) throw new Error("Nie udało się pobrać listy.");
  return data ? normalizeList(data as unknown as RawList) : null;
}

export async function getUserAlbumListChoices(userId: string, albumId: number): Promise<UserListChoice[]> {
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,name,is_public,items:user_list_items(album_id)")
    .eq("user_id", userId).eq("kind", "albums").order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać list użytkownika.");
  return (data ?? []).map(row => ({
    id: Number(row.id), name: String(row.name), is_public: Boolean(row.is_public),
    containsItem: (row.items ?? []).some(item => Number(item.album_id) === albumId),
  }));
}

export async function getUserTrackListChoices(userId: string, trackId: number): Promise<UserListChoice[]> {
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,name,is_public,items:user_track_list_items(track_id)")
    .eq("user_id", userId).eq("kind", "tracks").order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać playlist użytkownika.");
  return (data ?? []).map(row => ({
    id: Number(row.id), name: String(row.name), is_public: Boolean(row.is_public),
    containsItem: (row.items ?? []).some(item => Number(item.track_id) === trackId),
  }));
}

export async function getUserTrackListChoicesForTracks(userId: string, trackIds: number[]) {
  const result = new Map<number, UserListChoice[]>();
  trackIds.forEach(id => result.set(id, []));
  if (!trackIds.length) return result;
  const client = await createClient();
  const { data: lists, error: listError } = await client.from("user_lists")
    .select("id,name,is_public").eq("user_id", userId).eq("kind", "tracks")
    .order("updated_at", { ascending: false });
  if (listError) throw new Error("Nie udało się pobrać playlist użytkownika.");
  const listIds = (lists ?? []).map(list => Number(list.id));
  let contained = new Set<string>();
  if (listIds.length) {
    const { data: items, error: itemError } = await client.from("user_track_list_items")
      .select("list_id,track_id").in("list_id", listIds).in("track_id", trackIds);
    if (itemError) throw new Error("Nie udało się pobrać zawartości playlist.");
    contained = new Set((items ?? []).map(item => `${Number(item.list_id)}:${Number(item.track_id)}`));
  }
  trackIds.forEach(trackId => result.set(trackId, (lists ?? []).map(list => ({
    id: Number(list.id), name: String(list.name), is_public: Boolean(list.is_public),
    containsItem: contained.has(`${Number(list.id)}:${trackId}`),
  }))));
  return result;
}
