"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseYouTubeChannelId, parseYouTubeVideoId } from "@/lib/youtube";
import { addManualYouTubeChannel, addManualYouTubeVideo, syncArtistYouTubeVideos } from "@/lib/youtube-sync";

export type YouTubeSyncActionState = { success?: boolean; message?: string };

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") throw new Error("Brak uprawnień administratora.");
  return viewer;
}

function artistId(formData: FormData) {
  const value = Number(formData.get("artistId"));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Nieprawidłowy artysta.");
  return value;
}

function revalidateYouTube(artist?: number) {
  revalidatePath("/admin/teledyski");
  revalidatePath("/artist/[slug]", "page");
  if (artist) revalidatePath(`/artist/${artist}`);
}

export async function runYouTubeSync(state: YouTubeSyncActionState): Promise<YouTubeSyncActionState> {
  void state;
  try {
    const viewer = await requireAdmin();
    const result = await syncArtistYouTubeVideos({ startedBy: viewer.id, batchSize: 10 });
    revalidateYouTube();
    const quota = result.quotaReached ? " Osiągnięto bezpieczny dzienny limit wyszukiwań." : "";
    const failures = result.failures ? ` Błędy: ${result.failures}.` : "";
    return { success: true, message: `Sprawdzono ${result.artistsChecked} artystów, znaleziono ${result.videosFound} filmów, zapisano ${result.videosSaved}, automatycznie zatwierdzono ${result.videosAutoApproved}.${failures}${quota}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Synchronizacja YouTube nie powiodła się." };
  }
}

export async function reviewYouTubeVideo(formData: FormData) {
  await requireAdmin();
  const targetArtist = artistId(formData);
  const videoId = String(formData.get("videoId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !["approve", "reject"].includes(decision)) throw new Error("Nieprawidłowa decyzja moderacji.");
  if (reason.length > 1000) throw new Error("Powód odrzucenia może mieć najwyżej 1000 znaków.");
  const client = await createClient();
  const { error } = await client.rpc("review_artist_youtube_video", {
    target_artist_id: targetArtist,
    target_youtube_video_id: videoId,
    decision,
    official: formData.get("official") === "true",
    reason: reason || null,
  });
  if (error) throw new Error(`Nie udało się zapisać decyzji o teledysku: ${error.message}`);
  revalidateYouTube(targetArtist);
}

export async function reviewYouTubeChannel(formData: FormData) {
  await requireAdmin();
  const targetArtist = artistId(formData);
  const channelId = String(formData.get("channelId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId) || !["verify", "reject"].includes(decision)) throw new Error("Nieprawidłowa decyzja o kanale.");
  const client = await createClient();
  const { error } = await client.rpc("review_artist_youtube_channel", {
    target_artist_id: targetArtist,
    target_youtube_channel_id: channelId,
    decision,
  });
  if (error) throw new Error("Nie udało się zapisać decyzji o kanale.");
  revalidateYouTube(targetArtist);
}

export async function addManualChannel(formData: FormData) {
  const viewer = await requireAdmin();
  const targetArtist = artistId(formData);
  const channelId = parseYouTubeChannelId(String(formData.get("channel") ?? ""));
  if (!channelId) throw new Error("Podaj Channel ID albo adres youtube.com/channel/UC…");
  await addManualYouTubeChannel(targetArtist, channelId, viewer.id);
  revalidateYouTube(targetArtist);
}

export async function addManualVideo(formData: FormData) {
  const viewer = await requireAdmin();
  const targetArtist = artistId(formData);
  const videoId = parseYouTubeVideoId(String(formData.get("video") ?? ""));
  if (!videoId) throw new Error("Podaj prawidłowy adres albo ID filmu YouTube.");
  await addManualYouTubeVideo(targetArtist, videoId, viewer.id);
  revalidateYouTube(targetArtist);
}
