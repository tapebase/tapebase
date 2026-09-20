"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserListKind } from "@/lib/user-lists";
import { ratingErrorMessage } from "@/lib/rating-errors";

export type UserListActionState = { message?: string; success?: boolean; listId?: number; kind?: UserListKind; rating?: number | null };

const maxPlaylistCoverSize = 190 * 1024;

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

export async function updateUserListCover(listId: number, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się na aktywne konto, aby zmienić okładkę." };
  if (!validId(listId)) return { message: "Nieprawidłowa lista." };
  const { data: list } = await auth.client.from("user_lists").select("id")
    .eq("id", listId).eq("user_id", auth.userId).maybeSingle();
  if (!list) return { message: "Nie znaleziono tej listy." };

  const value = formData.get("cover");
  const cover = value instanceof File && value.size > 0 ? value : null;
  if (!cover || cover.type !== "image/jpeg" || cover.size > maxPlaylistCoverSize) {
    return { message: "Wybierz poprawną grafikę. TAPEBASE przygotuje ją jako kwadratowy plik JPEG." };
  }
  const bytes = new Uint8Array(await cover.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    return { message: "Plik nie jest prawidłową grafiką JPEG." };
  }

  const path = `${auth.userId}/${listId}.jpg`;
  const { error: uploadError } = await auth.client.storage.from("playlist-covers")
    .upload(path, bytes, { contentType: "image/jpeg", cacheControl: "3600", upsert: true });
  if (uploadError) return { message: "Nie udało się przesłać okładki." };
  const { data: publicFile } = auth.client.storage.from("playlist-covers").getPublicUrl(path);
  const coverUrl = `${publicFile.publicUrl}?v=${Date.now()}`;
  const { error } = await auth.client.from("user_lists").update({ cover_url: coverUrl })
    .eq("id", listId).eq("user_id", auth.userId);
  if (error) return { message: "Okładka została przesłana, ale nie udało się przypisać jej do listy." };
  refreshLists(listId);
  return { success: true, message: "Okładka została zapisana." };
}

export async function removeUserListCover(listId: number): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się na aktywne konto, aby usunąć okładkę." };
  if (!validId(listId)) return { message: "Nieprawidłowa lista." };
  const { data: list } = await auth.client.from("user_lists").select("id")
    .eq("id", listId).eq("user_id", auth.userId).maybeSingle();
  if (!list) return { message: "Nie znaleziono tej listy." };
  const { error } = await auth.client.from("user_lists").update({ cover_url: null })
    .eq("id", listId).eq("user_id", auth.userId);
  if (error) return { message: "Nie udało się usunąć okładki." };
  await auth.client.storage.from("playlist-covers").remove([`${auth.userId}/${listId}.jpg`]);
  refreshLists(listId);
  return { success: true, message: "Okładka została usunięta." };
}

export async function deleteUserList(listId: number) {
  const auth = await authorizedClient();
  if (!auth || !validId(listId)) return;
  const { data } = await auth.client.from("user_lists").delete().eq("id", listId).eq("user_id", auth.userId).select("id").maybeSingle();
  if (data) await auth.client.storage.from("playlist-covers").remove([`${auth.userId}/${listId}.jpg`]);
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

export async function saveUserListRating(listId: number, _state: UserListActionState, formData: FormData): Promise<UserListActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby ocenić playlistę." };
  if (!validId(listId)) return { message: "Nieprawidłowa playlista." };
  if (formData.get("intent") === "remove") {
    const { error } = await auth.client.from("user_list_ratings").delete()
      .eq("user_id", auth.userId).eq("list_id", listId);
    if (error) return { message: "Nie udało się usunąć oceny playlisty." };
    revalidatePath(`/lista/${listId}`);
    revalidatePath("/");
    return { success: true, message: "Ocena playlisty została usunięta.", rating: null };
  }
  const rating = Number(formData.get("rating"));
  if (!Number.isFinite(rating) || rating < 1 || rating > 10 || rating * 2 !== Math.floor(rating * 2)) {
    return { message: "Wybierz ocenę od 1 do 10." };
  }
  const { data: list, error: listError } = await auth.client.from("user_lists")
    .select("id,user_id,is_public,kind").eq("id", listId).maybeSingle();
  if (listError || !list || !list.is_public || list.kind !== "tracks") return { message: "Tej playlisty nie można ocenić." };
  if (list.user_id === auth.userId) return { message: "Nie możesz ocenić własnej playlisty." };
  const { error } = await auth.client.from("user_list_ratings").upsert(
    { user_id: auth.userId, list_id: listId, rating },
    { onConflict: "user_id,list_id" },
  );
  if (error) return { message: ratingErrorMessage(error, "Nie udało się zapisać oceny playlisty.") };
  revalidatePath(`/lista/${listId}`);
  revalidatePath("/");
  return { success: true, message: "Ocena playlisty została zapisana.", rating };
}
