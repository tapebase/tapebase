"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectSpotify, exportTrackListToSpotify, uploadSpotifyPlaylistCover } from "@/lib/spotify-user";

export type SpotifyPlaylistActionState = { message?: string; success?: boolean; url?: string };

async function viewerId() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return error ? null : id;
}

async function playlistCoverBase64(userId: string, listId: number) {
  const { data, error } = await createAdminClient().storage.from("playlist-covers")
    .download(`${userId}/${listId}.jpg`);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > 190 * 1024) throw new Error("Okładka playlisty jest zbyt duża dla Spotify.");
  return bytes.toString("base64");
}

export async function exportUserListToSpotify(listId: number, _state: SpotifyPlaylistActionState, _formData: FormData): Promise<SpotifyPlaylistActionState> {
  void _state;
  void _formData;
  const userId = await viewerId();
  if (!userId) return { message: "Zaloguj się, aby wyeksportować playlistę." };
  if (!Number.isSafeInteger(listId) || listId < 1) return { message: "Nieprawidłowa playlista." };
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,name,description,is_public,cover_url,kind,spotify_playlist_url,items:user_track_list_items(position,track:tracks(spotify_id))")
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
      coverBase64: data.cover_url ? await playlistCoverBase64(userId, listId) : null,
    });
    const { error: updateError } = await createAdminClient().from("user_lists").update({
      spotify_playlist_id: spotify.id,
      spotify_playlist_url: spotify.url,
      spotify_exported_at: new Date().toISOString(),
    }).eq("id", listId).eq("user_id", userId);
    if (updateError) return { success: true, message: "Playlista powstała w Spotify, ale TAPEBASE nie zapisało jej odnośnika.", url: spotify.url };
    revalidatePath(`/lista/${listId}`);
    revalidatePath("/listy");
    return {
      success: true,
      message: spotify.coverError
        ? `Playlista została utworzona, ale okładki nie udało się przesłać: ${spotify.coverError}`
        : data.cover_url
          ? "Playlista wraz z okładką została utworzona na Twoim koncie Spotify."
          : "Playlista została utworzona na Twoim koncie Spotify.",
      url: spotify.url,
    };
  } catch (caught) {
    return { message: caught instanceof Error ? caught.message : "Nie udało się wyeksportować playlisty." };
  }
}

export async function updateUserListSpotifyCover(listId: number, _state: SpotifyPlaylistActionState, _formData: FormData): Promise<SpotifyPlaylistActionState> {
  void _state;
  void _formData;
  const userId = await viewerId();
  if (!userId) return { message: "Zaloguj się, aby zaktualizować okładkę w Spotify." };
  if (!Number.isSafeInteger(listId) || listId < 1) return { message: "Nieprawidłowa playlista." };
  const client = await createClient();
  const { data, error } = await client.from("user_lists")
    .select("id,cover_url,spotify_playlist_id,spotify_playlist_url")
    .eq("id", listId).eq("user_id", userId).eq("kind", "tracks").maybeSingle();
  if (error || !data?.spotify_playlist_id) return { message: "Ta playlista nie została jeszcze utworzona w Spotify." };
  if (!data.cover_url) return { message: "Najpierw dodaj własną okładkę playlisty." };
  try {
    const cover = await playlistCoverBase64(userId, listId);
    if (!cover) return { message: "Nie udało się odczytać zapisanej okładki." };
    await uploadSpotifyPlaylistCover(userId, String(data.spotify_playlist_id), cover);
    return { success: true, message: "Okładka w Spotify została zaktualizowana.", url: data.spotify_playlist_url ? String(data.spotify_playlist_url) : undefined };
  } catch (caught) {
    return { message: caught instanceof Error ? caught.message : "Nie udało się zaktualizować okładki w Spotify." };
  }
}

export async function disconnectUserSpotify() {
  const userId = await viewerId();
  if (!userId) return;
  await disconnectSpotify(userId);
  revalidatePath("/listy");
  revalidatePath("/lista/[id]", "page");
}
