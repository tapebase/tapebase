"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectSpotify, exportTrackListToSpotify } from "@/lib/spotify-user";

export type SpotifyPlaylistActionState = { message?: string; success?: boolean; url?: string };

async function viewerId() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return error ? null : id;
}

export async function exportUserListToSpotify(listId: number, _state: SpotifyPlaylistActionState, _formData: FormData): Promise<SpotifyPlaylistActionState> {
  void _state;
  void _formData;
  const userId = await viewerId();
  if (!userId) return { message: "Zaloguj się, aby wyeksportować playlistę." };
  if (!Number.isSafeInteger(listId) || listId < 1) return { message: "Nieprawidłowa playlista." };
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,name,description,is_public,kind,spotify_playlist_url,items:user_track_list_items(position,track:tracks(spotify_id))")
    .eq("id", listId).eq("user_id", userId).maybeSingle();
  if (error || !data || data.kind !== "tracks") return { message: "Nie znaleziono tej playlisty." };
  if (data.spotify_playlist_url) return { success: true, message: "Ta playlista została już utworzona w Spotify.", url: String(data.spotify_playlist_url) };
  const tracks = (data.items ?? []).sort((a, b) => Number(a.position) - Number(b.position)).flatMap(item => {
    const related = Array.isArray(item.track) ? item.track[0] : item.track;
    return related ? [{ spotify_id: related.spotify_id ? String(related.spotify_id) : null }] : [];
  });
  try {
    const spotify = await exportTrackListToSpotify(userId, {
      name: String(data.name), description: data.description ? String(data.description) : null,
      is_public: Boolean(data.is_public), tracks,
    });
    const { error: updateError } = await createAdminClient().from("user_lists").update({
      spotify_playlist_id: spotify.id,
      spotify_playlist_url: spotify.url,
      spotify_exported_at: new Date().toISOString(),
    }).eq("id", listId).eq("user_id", userId);
    if (updateError) return { success: true, message: "Playlista powstała w Spotify, ale TAPEBASE nie zapisało jej odnośnika.", url: spotify.url };
    revalidatePath(`/lista/${listId}`);
    revalidatePath("/listy");
    return { success: true, message: "Playlista została utworzona na Twoim koncie Spotify.", url: spotify.url };
  } catch (caught) {
    return { message: caught instanceof Error ? caught.message : "Nie udało się wyeksportować playlisty." };
  }
}

export async function disconnectUserSpotify() {
  const userId = await viewerId();
  if (!userId) return;
  await disconnectSpotify(userId);
  revalidatePath("/listy");
  revalidatePath("/lista/[id]", "page");
}
