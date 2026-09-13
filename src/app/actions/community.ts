"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommunityActionState = { message?: string; success?: boolean };

async function authorizedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) return null;
  const { data: profile } = await client.from("users").select("suspended_at").eq("id", userId).maybeSingle();
  return !profile || profile.suspended_at ? null : { client, userId };
}

function validAlbumId(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

export type CommentTargetType = "album" | "artist";

function commentTarget(type: CommentTargetType, id: number) {
  if (!validAlbumId(id) || !["album", "artist"].includes(type)) return null;
  return type === "album"
    ? { column: "album_id" as const, values: { album_id: id, artist_id: null } }
    : { column: "artist_id" as const, values: { album_id: null, artist_id: id } };
}

function revalidateCommentTarget(type: CommentTargetType) {
  revalidatePath(type === "album" ? "/album/[slug]" : "/artist/[slug]", "page");
  revalidatePath("/profil");
  revalidatePath("/");
}

export async function saveRating(
  albumId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby ocenić album." };
  const rating = Number(formData.get("rating"));
  if (!validAlbumId(albumId) || !Number.isFinite(rating) || rating < 1 || rating > 10 || rating * 2 !== Math.floor(rating * 2)) {
    return { message: "Wybierz ocenę od 1 do 10 co 0,5." };
  }

  const { error } = await auth.client.from("ratings").upsert(
    { user_id: auth.userId, album_id: albumId, rating },
    { onConflict: "user_id,album_id" },
  );
  if (error) return { message: "Nie udało się zapisać oceny." };
  revalidatePath("/album/[slug]", "page");
  revalidatePath("/profil");
  return { success: true, message: "Ocena zapisana." };
}

export async function saveArtistRating(
  artistId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby ocenić artystę." };
  const rating = Number(formData.get("rating"));
  if (!validAlbumId(artistId) || !Number.isFinite(rating) || rating < 1 || rating > 10 || rating * 2 !== Math.floor(rating * 2)) {
    return { message: "Wybierz ocenę od 1 do 10 co 0,5." };
  }

  const { error } = await auth.client.from("artist_ratings").upsert(
    { user_id: auth.userId, artist_id: artistId, rating },
    { onConflict: "user_id,artist_id" },
  );
  if (error) return { message: "Nie udało się zapisać oceny artysty." };
  revalidatePath("/artist/[slug]", "page");
  revalidatePath("/profil");
  return { success: true, message: "Ocena artysty zapisana." };
}

async function setAlbumList(
  table: "listened" | "want_to_listen",
  albumId: number,
  enabled: boolean,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby zmienić listę." };
  if (!validAlbumId(albumId)) return { message: "Nieprawidłowy album." };
  const query = enabled
    ? auth.client.from(table).upsert(
      { user_id: auth.userId, album_id: albumId },
      { onConflict: "user_id,album_id", ignoreDuplicates: true },
    )
    : auth.client.from(table).delete().eq("user_id", auth.userId).eq("album_id", albumId);
  const { error } = await query;
  if (error) return { message: "Nie udało się zmienić listy." };
  revalidatePath("/album/[slug]", "page");
  revalidatePath("/profil");
  return { success: true, message: enabled ? "Dodano do listy." : "Usunięto z listy." };
}

export async function toggleListened(
  albumId: number,
  enabled: boolean,
  _state: CommunityActionState,
): Promise<CommunityActionState> {
  void _state;
  return setAlbumList("listened", albumId, enabled);
}

export async function toggleWantToListen(
  albumId: number,
  enabled: boolean,
  _state: CommunityActionState,
): Promise<CommunityActionState> {
  void _state;
  return setAlbumList("want_to_listen", albumId, enabled);
}

export async function addComment(
  albumId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby dodać komentarz." };
  const content = typeof formData.get("content") === "string" ? String(formData.get("content")).trim() : "";
  if (!validAlbumId(albumId) || content.length < 1 || content.length > 2000) {
    return { message: "Komentarz musi mieć od 1 do 2000 znaków." };
  }
  const { error } = await auth.client.from("comments").insert({ user_id: auth.userId, album_id: albumId, content });
  if (error) return { message: "Nie udało się dodać komentarza." };
  revalidatePath("/album/[slug]", "page");
  revalidatePath("/profil");
  revalidatePath("/");
  return { success: true, message: "Komentarz dodany." };
}

export async function addArtistComment(
  artistId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby dodać komentarz." };
  const content = typeof formData.get("content") === "string" ? String(formData.get("content")).trim() : "";
  if (!validAlbumId(artistId) || content.length < 1 || content.length > 2000) {
    return { message: "Komentarz musi mieć od 1 do 2000 znaków." };
  }
  const { error } = await auth.client.from("comments").insert({ user_id: auth.userId, artist_id: artistId, content });
  if (error) return { message: "Nie udało się dodać komentarza." };
  revalidateCommentTarget("artist");
  return { success: true, message: "Komentarz dodany." };
}

export async function addReply(
  targetType: CommentTargetType,
  targetId: number,
  parentCommentId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby odpowiedzieć." };
  const content = typeof formData.get("content") === "string" ? String(formData.get("content")).trim() : "";
  const target = commentTarget(targetType, targetId);
  if (!target || !Number.isSafeInteger(parentCommentId) || parentCommentId < 1 || content.length < 1 || content.length > 2000) {
    return { message: "Odpowiedź musi mieć od 1 do 2000 znaków." };
  }
  const { data: parent, error: parentError } = await auth.client.from("comments")
    .select("id")
    .eq("id", parentCommentId)
    .eq(target.column, targetId)
    .maybeSingle();
  if (parentError || !parent) return { message: "Komentarz, na który odpowiadasz, już nie istnieje." };
  const { error } = await auth.client.from("comments").insert({
    user_id: auth.userId,
    ...target.values,
    parent_comment_id: parentCommentId,
    content,
  });
  if (error) return { message: "Nie udało się dodać odpowiedzi." };
  revalidateCommentTarget(targetType);
  return { success: true, message: "Odpowiedź dodana." };
}

export async function editComment(
  targetType: CommentTargetType,
  targetId: number,
  commentId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby edytować komentarz." };
  const content = typeof formData.get("content") === "string" ? String(formData.get("content")).trim() : "";
  const target = commentTarget(targetType, targetId);
  if (!target || !Number.isSafeInteger(commentId) || commentId < 1 || content.length < 1 || content.length > 2000) {
    return { message: "Komentarz musi mieć od 1 do 2000 znaków." };
  }
  const { data, error } = await auth.client.from("comments")
    .update({ content })
    .eq("id", commentId)
    .eq("user_id", auth.userId)
    .eq(target.column, targetId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { message: "Nie udało się edytować komentarza." };
  revalidateCommentTarget(targetType);
  return { success: true, message: "Komentarz został zaktualizowany." };
}

export async function toggleCommentLike(
  targetType: CommentTargetType,
  targetId: number,
  commentId: number,
  enabled: boolean,
  _state: CommunityActionState,
): Promise<CommunityActionState> {
  void _state;
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się, aby polubić komentarz." };
  if (!commentTarget(targetType, targetId) || !Number.isSafeInteger(commentId) || commentId < 1) {
    return { message: "Nieprawidłowy komentarz." };
  }
  const query = enabled
    ? auth.client.from("comment_likes").insert({ user_id: auth.userId, comment_id: commentId })
    : auth.client.from("comment_likes").delete().eq("user_id", auth.userId).eq("comment_id", commentId);
  const { error } = await query;
  if (error) return { message: enabled ? "Nie możesz polubić tego komentarza." : "Nie udało się cofnąć polubienia." };
  revalidateCommentTarget(targetType);
  return { success: true };
}

export async function reportComment(
  commentId: number,
  _state: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const auth = await authorizedClient();
  if (!auth) return { message: "Zaloguj się na aktywne konto, aby zgłosić komentarz." };
  const category = String(formData.get("category") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  if (!Number.isSafeInteger(commentId) || commentId < 1 || !["spam", "abuse", "spoiler", "other"].includes(category) || details.length > 1000) {
    return { message: "Sprawdź powód i opis zgłoszenia." };
  }
  const { error } = await auth.client.rpc("report_comment", {
    target_comment_id: commentId,
    report_category: category,
    report_details: details || null,
  });
  if (error) return { message: "Nie udało się zgłosić tego komentarza." };
  revalidatePath("/admin/komentarze");
  return { success: true, message: "Komentarz został przekazany moderatorom." };
}

export async function deleteComment(targetType: CommentTargetType, targetId: number, commentId: number) {
  const auth = await authorizedClient();
  const target = commentTarget(targetType, targetId);
  if (!auth || !target || !Number.isSafeInteger(commentId)) return;
  await auth.client.from("comments").delete().eq("id", commentId).eq("user_id", auth.userId).eq(target.column, targetId);
  revalidateCommentTarget(targetType);
}
