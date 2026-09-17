import "server-only";

import { catalogClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export type UserListAlbum = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
};

export type UserListItem = {
  added_at: string;
  album: UserListAlbum;
};

export type UserAlbumList = {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  owner: { username: string; avatar_url: string | null } | null;
  items: UserListItem[];
};

export type UserListChoice = {
  id: number;
  name: string;
  is_public: boolean;
  containsAlbum: boolean;
};

type Related<T> = T | T[] | null;
type RawListItem = { added_at: string; album: Related<UserListAlbum> };
type RawList = Omit<UserAlbumList, "owner" | "items"> & {
  owner: Related<{ username: string; avatar_url: string | null }>;
  items: RawListItem[] | null;
};

const listFields = "id,user_id,name,description,is_public,created_at,updated_at,owner:users!user_lists_user_id_fkey(username,avatar_url),items:user_list_items(added_at,album:albums(id,title,slug,cover_url))";

function one<T>(value: Related<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeList(row: RawList): UserAlbumList {
  const items = (row.items ?? []).flatMap(item => {
    const album = one(item.album);
    return album ? [{ added_at: item.added_at, album }] : [];
  }).sort((a, b) => b.added_at.localeCompare(a.added_at));
  return { ...row, owner: one(row.owner), items };
}

export async function getOwnUserLists(userId: string) {
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select(listFields)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać Twoich list.");
  return ((data ?? []) as unknown as RawList[]).map(normalizeList);
}

export async function getPublicUserLists(userId: string) {
  const { data, error } = await catalogClient().from("user_lists")
    .select(listFields)
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać publicznych list.");
  return ((data ?? []) as unknown as RawList[]).map(normalizeList);
}

export async function getUserListById(id: number, signedIn: boolean) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const client = signedIn ? await createClient() : catalogClient();
  const { data, error } = await client.from("user_lists")
    .select(listFields)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nie udało się pobrać listy.");
  return data ? normalizeList(data as unknown as RawList) : null;
}

export async function getUserListChoices(userId: string, albumId: number): Promise<UserListChoice[]> {
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,name,is_public,items:user_list_items(album_id)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać list użytkownika.");
  return (data ?? []).map(row => ({
    id: Number(row.id),
    name: String(row.name),
    is_public: Boolean(row.is_public),
    containsAlbum: (row.items ?? []).some(item => Number(item.album_id) === albumId),
  }));
}
