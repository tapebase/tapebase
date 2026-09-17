"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserListKind } from "@/lib/user-lists";

export type UserListActionState = { message?: string; success?: boolean; listId?: number; kind?: UserListKind };

async function authorizedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) return null;
  const { data: profile } = await client.from("users").select("suspended_at").eq("id", userId).maybeSingle();
  return !profile || profile.suspended_at ? null : { client, userId };
}

function listValues(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 1 || name.length > 80 || description.length > 500) return null;
  return { name, description: description || null, is_public: formData.get("isPublic") === "on" };
}

function listKind(formData: FormData): UserListKind | null {
  const kind = String(formData.get("kind") ?? "");
  return kind === "albums" || kind === "tracks" ? kind : null;
}

function validId(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function refreshLists(listId?: number) {
  revalidatePath("/listy");
  revalidatePath("/profil");
  revalidatePath("/u/[username]", "page");
  if (listId) revalidatePath(`/lista/${listId}`);
}

export async function createUserList(_state: UserListActionState, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się na aktywne konto, aby utworzyć listę." };
  const values = listValues(formData);
  const kind = listKind(formData);
  if (!values || !kind) return { message: "Wybierz rodzaj listy i sprawdź nazwę oraz opis." };
  const { data, error } = await auth.client.from("user_lists")
    .insert({ user_id: auth.userId, kind, ...values }).select("id").single();
  if (error?.code === "23505") return { message: "Masz już listę o takiej nazwie." };
  if (error) return { message: error.message.includes("limit") ? "Osiągnięto limit 50 list." : "Nie udało się utworzyć listy." };
  refreshLists();
  return { success: true, message: "Lista została utworzona.", listId: Number(data.id), kind };
}

export async function updateUserList(listId: number, _state: UserListActionState, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się na aktywne konto, aby edytować listę." };
  const values = listValues(formData);
  if (!validId(listId) || !values) return { message: "Sprawdź nazwę i opis listy." };
  const { data, error } = await auth.client.from("user_lists").update(values)
    .eq("id", listId).eq("user_id", auth.userId).select("id").maybeSingle();
  if (error?.code === "23505") return { message: "Masz już listę o takiej nazwie." };
  if (error || !data) return { message: "Nie udało się zapisać listy." };
  refreshLists(listId);
  return { success: true, message: "Lista została zaktualizowana." };
}

export async function deleteUserList(listId: number) {
  const auth = await authorizedClient();
  if (!auth || !validId(listId)) return;
  await auth.client.from("user_lists").delete().eq("id", listId).eq("user_id", auth.userId);
  refreshLists();
  redirect("/listy");
}

export async function addAlbumToUserList(albumId: number, _state: UserListActionState, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby dodać album do listy." };
  const listId = Number(formData.get("listId"));
  if (!validId(albumId) || !validId(listId)) return { message: "Wybierz listę." };
  const { data: list, error: listError } = await auth.client.from("user_lists").select("id").eq("id", listId).eq("user_id", auth.userId).eq("kind", "albums").maybeSingle();
  if (listError || !list) return { message: "Nie znaleziono tej listy." };
  const { error } = await auth.client.from("user_list_items").upsert({ list_id: listId, album_id: albumId }, { onConflict: "list_id,album_id", ignoreDuplicates: true });
  if (error) return { message: error.message.includes("limit") ? "Ta lista zawiera już maksymalnie 500 albumów." : "Nie udało się dodać albumu." };
  refreshLists(listId);
  revalidatePath("/album/[slug]", "page");
  return { success: true, message: "Album został dodany do listy." };
}

export async function removeAlbumFromUserList(listId: number, albumId: number) {
  const auth = await authorizedClient();
  if (!auth || !validId(listId) || !validId(albumId)) return;
  const { data: list } = await auth.client.from("user_lists").select("id").eq("id", listId).eq("user_id", auth.userId).maybeSingle();
  if (!list) return;
  await auth.client.from("user_list_items").delete().eq("list_id", listId).eq("album_id", albumId);
  refreshLists(listId);
  revalidatePath("/album/[slug]", "page");
}

export async function addTrackToUserList(trackId: number, _state: UserListActionState, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby dodać utwór do playlisty." };
  const listId = Number(formData.get("listId"));
  if (!validId(trackId) || !validId(listId)) return { message: "Wybierz playlistę." };
  const { data: list, error: listError } = await auth.client.from("user_lists")
    .select("id").eq("id", listId).eq("user_id", auth.userId).eq("kind", "tracks").maybeSingle();
  if (listError || !list) return { message: "Nie znaleziono tej playlisty." };
  const { data: existing } = await auth.client.from("user_track_list_items")
    .select("track_id").eq("list_id", listId).eq("track_id", trackId).maybeSingle();
  if (existing) return { success: true, message: "Ten utwór jest już na playliście." };
  const { data: last } = await auth.client.from("user_track_list_items")
    .select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await auth.client.from("user_track_list_items")
    .insert({ list_id: listId, track_id: trackId, position: Number(last?.position ?? 0) + 1 });
  if (error) return { message: error.message.includes("limit") ? "Ta playlista zawiera już maksymalnie 500 utworów." : "Nie udało się dodać utworu." };
  refreshLists(listId);
  revalidatePath("/album/[slug]", "page");
  revalidatePath("/utwory");
  return { success: true, message: "Utwór został dodany do playlisty." };
}

export async function removeTrackFromUserList(listId: number, trackId: number) {
  const auth = await authorizedClient();
  if (!auth || !validId(listId) || !validId(trackId)) return;
  const { data: list } = await auth.client.from("user_lists")
    .select("id").eq("id", listId).eq("user_id", auth.userId).eq("kind", "tracks").maybeSingle();
  if (!list) return;
  await auth.client.from("user_track_list_items").delete().eq("list_id", listId).eq("track_id", trackId);
  refreshLists(listId);
  revalidatePath("/album/[slug]", "page");
  revalidatePath("/utwory");
}
