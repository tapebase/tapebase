import "server-only";

import { importClient } from "../../scripts/spotify/writer.mts";
import {
  classifyChannel,
  getYouTubeChannel,
  getYouTubeVideos,
  inferTrustedChannels,
  scoreVideoCandidate,
  searchArtistVideos,
  wikidataYouTubeChannel,
  type TrackIdentity,
  type VideoCandidate,
  YouTubeApiError,
} from "@/lib/youtube";

const SEARCH_DAILY_LIMIT = 50;
const SEARCH_INTERVAL_DAYS = 7;

type AdminClient = ReturnType<typeof importClient>;
type ArtistSyncRow = {
  artist_id: number;
  artist: {
    id: number;
    name: string;
    enrichment_source: string | null;
    enrichment_source_id: string | null;
  } | null;
};

export type YouTubeSyncResult = {
  artistsChecked: number;
  searchCalls: number;
  videosFound: number;
  videosSaved: number;
  videosAutoApproved: number;
  failures: number;
  quotaReached: boolean;
};

function requiredApiKey() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new Error("Dodaj YOUTUBE_API_KEY do konfiguracji serwera.");
  return key;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Nieznany błąd synchronizacji YouTube.").slice(0, 1000);
}

function nextDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function assertDatabase(error: { message: string } | null, message: string) {
  if (error) throw new Error(`${message}: ${error.message}`);
}

async function saveChannel(
  database: AdminClient,
  input: { id: string; title: string; thumbnailUrl?: string | null; uploadsPlaylistId?: string | null },
  verification: "candidate" | "verified" = "candidate",
) {
  const { data: existing, error: readError } = await database.from("youtube_channels")
    .select("verification_status,channel_type").eq("youtube_channel_id", input.id).maybeSingle();
  assertDatabase(readError, "Nie udało się sprawdzić kanału YouTube");
  const status = existing?.verification_status === "verified" ? "verified" : verification;
  const channelType = existing?.channel_type && existing.channel_type !== "unknown"
    ? existing.channel_type : classifyChannel(input.title);
  const { error } = await database.from("youtube_channels").upsert({
    youtube_channel_id: input.id,
    title: input.title,
    thumbnail_url: input.thumbnailUrl ?? null,
    uploads_playlist_id: input.uploadsPlaylistId ?? null,
    channel_type: channelType,
    verification_status: status,
    last_refreshed_at: new Date().toISOString(),
  }, { onConflict: "youtube_channel_id" });
  assertDatabase(error, "Nie udało się zapisać kanału YouTube");
}

async function linkChannel(
  database: AdminClient,
  artistId: number,
  channelId: string,
  method: "wikidata" | "youtube_search" | "manual",
  status: "candidate" | "verified",
  confidence: number,
  evidence: Record<string, unknown>,
  reviewedBy?: string,
) {
  const { data: existing, error: readError } = await database.from("artist_youtube_channels")
    .select("status").eq("artist_id", artistId).eq("youtube_channel_id", channelId).maybeSingle();
  assertDatabase(readError, "Nie udało się sprawdzić powiązania kanału");
  if (existing?.status === "verified" || existing?.status === "rejected") return existing.status;
  const { error } = await database.from("artist_youtube_channels").upsert({
    artist_id: artistId,
    youtube_channel_id: channelId,
    match_method: method,
    confidence_score: confidence,
    match_evidence: evidence,
    status,
    reviewed_by: reviewedBy ?? null,
    reviewed_at: reviewedBy ? new Date().toISOString() : null,
  }, { onConflict: "artist_id,youtube_channel_id" });
  assertDatabase(error, "Nie udało się powiązać kanału z artystą");
  return status;
}

async function loadTracks(database: AdminClient, artistId: number): Promise<TrackIdentity[]> {
  const { data, error } = await database.from("spotify_track_artists")
    .select("track:tracks(id,title)").eq("artist_id", artistId).limit(2000);
  assertDatabase(error, "Nie udało się pobrać utworów artysty");
  const unique = new Map<number, TrackIdentity>();
  for (const row of data ?? []) {
    const track = Array.isArray(row.track) ? row.track[0] : row.track;
    if (track && typeof track.id === "number" && typeof track.title === "string") unique.set(track.id, track);
  }
  return [...unique.values()];
}

async function ensureWikidataChannel(database: AdminClient, apiKey: string, artist: NonNullable<ArtistSyncRow["artist"]>) {
  if (artist.enrichment_source !== "wikidata" || !artist.enrichment_source_id) return null;
  const channelId = await wikidataYouTubeChannel(artist.enrichment_source_id);
  if (!channelId) return null;
  const channel = await getYouTubeChannel(apiKey, channelId);
  if (!channel?.id || !channel.snippet?.title) return null;
  const thumbnails = channel.snippet.thumbnails;
  const thumbnail = thumbnails ? Object.values(thumbnails).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null : null;
  await saveChannel(database, {
    id: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: thumbnail,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? null,
  }, "verified");
  await linkChannel(database, artist.id, channel.id, "wikidata", "verified", 1, {
    wikidataQid: artist.enrichment_source_id,
    property: "P2397",
  });
  return channel.id;
}

async function verifiedChannelIds(database: AdminClient, artistId: number) {
  const { data, error } = await database.from("artist_youtube_channels")
    .select("youtube_channel_id").eq("artist_id", artistId).eq("status", "verified");
  assertDatabase(error, "Nie udało się pobrać zatwierdzonych kanałów");
  return new Set((data ?? []).map(item => item.youtube_channel_id));
}

async function reserveSearch(database: AdminClient) {
  const { data, error } = await database.rpc("reserve_youtube_search_quota", {
    requested_calls: 1,
    daily_limit: SEARCH_DAILY_LIMIT,
  });
  assertDatabase(error, "Nie udało się zarezerwować limitu YouTube");
  return data === true;
}

async function saveVideoCandidates(
  database: AdminClient,
  artist: NonNullable<ArtistSyncRow["artist"]>,
  videos: VideoCandidate[],
  tracks: TrackIdentity[],
  verified: Set<string>,
) {
  const ids = videos.map(video => video.videoId);
  const { data: existing, error: existingError } = ids.length
    ? await database.from("artist_videos").select("youtube_video_id,status")
      .eq("artist_id", artist.id).in("youtube_video_id", ids)
    : { data: [], error: null };
  assertDatabase(existingError, "Nie udało się sprawdzić zapisanych teledysków");
  const statuses = new Map((existing ?? []).map(row => [row.youtube_video_id, row.status]));
  let saved = 0, approved = 0;

  for (const video of videos) {
    const match = scoreVideoCandidate({
      video,
      artistName: artist.name,
      tracks,
      verifiedChannel: verified.has(video.channelId),
    });
    if (match.rejected) continue;

    await saveChannel(database, { id: video.channelId, title: video.channelTitle });
    // Channel identity is reused across many videos, so only meaningful
    // matches belong in its separate moderation queue. We still keep weaker
    // video candidates for independent review.
    if (!verified.has(video.channelId) && match.confidence >= 0.4) {
      await linkChannel(database, artist.id, video.channelId, "youtube_search", "candidate",
        match.confidence, { discoveredFromVideo: video.videoId, channelType: classifyChannel(video.channelTitle) });
    }
    const { error: videoError } = await database.from("youtube_videos").upsert({
      youtube_video_id: video.videoId,
      youtube_channel_id: video.channelId,
      title: video.title,
      thumbnail_url: video.thumbnailUrl,
      channel_title: video.channelTitle,
      view_count: video.viewCount,
      published_at: video.publishedAt,
      duration_seconds: video.durationSeconds,
      is_embeddable: video.embeddable,
      availability_status: video.available ? "available" : "unavailable",
      last_refreshed_at: new Date().toISOString(),
    }, { onConflict: "youtube_video_id" });
    assertDatabase(videoError, `Nie udało się zapisać filmu ${video.videoId}`);

    const previous = statuses.get(video.videoId);
    if (previous === "approved" || previous === "rejected") continue;
    const status = match.autoApprove ? "approved" : "pending";
    const { error: relationError } = await database.from("artist_videos").upsert({
      artist_id: artist.id,
      youtube_video_id: video.videoId,
      matched_track_id: match.matchedTrackId,
      status,
      is_official: match.isOfficial,
      confidence_score: match.confidence,
      match_evidence: match.evidence,
      rejection_reason: null,
    }, { onConflict: "artist_id,youtube_video_id" });
    assertDatabase(relationError, `Nie udało się przypisać filmu ${video.videoId}`);
    saved++;
    if (status === "approved" && previous !== "approved") approved++;
  }
  return { saved, approved };
}

async function refreshVideoStats(database: AdminClient, apiKey: string) {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const { data, error } = await database.from("youtube_videos")
    .select("youtube_video_id").lt("last_refreshed_at", cutoff)
    .order("last_refreshed_at").limit(50);
  assertDatabase(error, "Nie udało się pobrać filmów do odświeżenia");
  const ids = (data ?? []).map(item => item.youtube_video_id);
  if (!ids.length) return;
  const videos = await getYouTubeVideos(apiKey, ids);
  const returned = new Set(videos.map(video => video.videoId));
  for (const video of videos) {
    const { error: updateError } = await database.from("youtube_videos").update({
      title: video.title,
      thumbnail_url: video.thumbnailUrl,
      channel_title: video.channelTitle,
      view_count: video.viewCount,
      published_at: video.publishedAt,
      duration_seconds: video.durationSeconds,
      is_embeddable: video.embeddable,
      availability_status: video.available ? "available" : "unavailable",
      last_refreshed_at: new Date().toISOString(),
    }).eq("youtube_video_id", video.videoId);
    assertDatabase(updateError, `Nie udało się odświeżyć filmu ${video.videoId}`);
  }
  const missing = ids.filter(id => !returned.has(id));
  if (missing.length) {
    const { error: missingError } = await database.from("youtube_videos").update({
      availability_status: "unavailable", last_refreshed_at: new Date().toISOString(),
    }).in("youtube_video_id", missing);
    assertDatabase(missingError, "Nie udało się oznaczyć niedostępnych filmów");
  }
}

export async function syncArtistYouTubeVideos(options: { startedBy?: string | null; batchSize?: number } = {}): Promise<YouTubeSyncResult> {
  const apiKey = requiredApiKey();
  const database = importClient();
  const batchSize = Math.max(1, Math.min(20, Math.trunc(options.batchSize ?? 10)));
  const stale = new Date(Date.now() - 15 * 60000).toISOString();
  await database.from("youtube_sync_runs").update({
    status: "failed", error_message: "Przerwane uruchomienie zostało odzyskane.", finished_at: new Date().toISOString(),
  }).eq("status", "running").lt("started_at", stale);
  await database.from("artist_youtube_sync").update({ status: "pending", locked_until: null })
    .eq("status", "running").lt("locked_until", new Date().toISOString());

  const { data: run, error: runError } = await database.from("youtube_sync_runs")
    .insert({ started_by: options.startedBy ?? null }).select("id").single();
  if (runError?.code === "23505") throw new Error("Inna synchronizacja YouTube jest już w trakcie.");
  assertDatabase(runError, "Nie udało się rozpocząć synchronizacji YouTube");

  const result: YouTubeSyncResult = {
    artistsChecked: 0, searchCalls: 0, videosFound: 0, videosSaved: 0,
    videosAutoApproved: 0, failures: 0, quotaReached: false,
  };
  const errors: string[] = [];
  try {
    await refreshVideoStats(database, apiKey);
    const { data: rows, error } = await database.from("artist_youtube_sync")
      .select("artist_id,artist:artists!artist_youtube_sync_artist_id_fkey(id,name,enrichment_source,enrichment_source_id)")
      .in("status", ["pending", "completed", "failed"])
      .lte("next_search_at", new Date().toISOString()).order("next_search_at").limit(batchSize)
      .returns<ArtistSyncRow[]>();
    assertDatabase(error, "Nie udało się pobrać kolejki YouTube");

    for (const row of rows ?? []) {
      const artist = row.artist;
      if (!artist?.name) continue;
      if (!(await reserveSearch(database))) {
        result.quotaReached = true;
        break;
      }
      result.searchCalls++;
      await database.from("artist_youtube_sync").update({
        status: "running", locked_until: new Date(Date.now() + 5 * 60000).toISOString(), last_error: null,
      }).eq("artist_id", artist.id);
      try {
        await ensureWikidataChannel(database, apiKey, artist);
        const tracks = await loadTracks(database, artist.id);
        const ids = await searchArtistVideos(apiKey, artist.name);
        result.videosFound += ids.length;
        const videos = await getYouTubeVideos(apiKey, ids);
        for (const inferred of inferTrustedChannels(videos, artist.name, tracks)) {
          await saveChannel(database, { id: inferred.channelId, title: inferred.channelTitle });
          const status = await linkChannel(database, artist.id, inferred.channelId, "youtube_search", "verified",
            inferred.confidence, inferred.evidence);
          if (status === "verified") {
            await saveChannel(database, { id: inferred.channelId, title: inferred.channelTitle }, "verified");
          }
        }
        const verified = await verifiedChannelIds(database, artist.id);
        const stored = await saveVideoCandidates(database, artist, videos, tracks, verified);
        result.videosSaved += stored.saved;
        result.videosAutoApproved += stored.approved;
        result.artistsChecked++;
        const { error: stateError } = await database.from("artist_youtube_sync").update({
          status: "completed", next_search_at: nextDate(SEARCH_INTERVAL_DAYS),
          last_search_at: new Date().toISOString(), locked_until: null, last_error: null,
        }).eq("artist_id", artist.id);
        assertDatabase(stateError, "Nie udało się zapisać postępu synchronizacji");
      } catch (error) {
        const message = safeError(error);
        errors.push(`${artist.name}: ${message}`);
        result.failures++;
        await database.from("artist_youtube_sync").update({
          status: "failed", next_search_at: nextDate(1), locked_until: null, last_error: message,
        }).eq("artist_id", artist.id);
        if (error instanceof YouTubeApiError && error.quotaExceeded) {
          result.quotaReached = true;
          break;
        }
      }
    }
    const { error: finishError } = await database.from("youtube_sync_runs").update({
      status: "completed",
      artists_checked: result.artistsChecked,
      search_calls: result.searchCalls,
      videos_found: result.videosFound,
      videos_saved: result.videosSaved,
      videos_auto_approved: result.videosAutoApproved,
      error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
      finished_at: new Date().toISOString(),
    }).eq("id", run!.id);
    assertDatabase(finishError, "Nie udało się zakończyć historii synchronizacji");
    return result;
  } catch (error) {
    await database.from("youtube_sync_runs").update({
      status: "failed", error_message: safeError(error), finished_at: new Date().toISOString(),
    }).eq("id", run!.id);
    throw error;
  }
}

export async function addManualYouTubeChannel(artistId: number, channelId: string, adminId: string) {
  const apiKey = requiredApiKey(), database = importClient();
  const channel = await getYouTubeChannel(apiKey, channelId);
  if (!channel?.id || !channel.snippet?.title) throw new Error("Nie znaleziono kanału YouTube.");
  const thumbnails = channel.snippet.thumbnails;
  const thumbnail = thumbnails ? Object.values(thumbnails).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null : null;
  await saveChannel(database, {
    id: channel.id, title: channel.snippet.title, thumbnailUrl: thumbnail,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? null,
  }, "verified");
  await linkChannel(database, artistId, channel.id, "manual", "verified", 1, { adminApproved: true }, adminId);
  await database.from("artist_youtube_sync").update({ status: "pending", next_search_at: new Date().toISOString() }).eq("artist_id", artistId);
}

export async function addManualYouTubeVideo(artistId: number, videoId: string, adminId: string) {
  const apiKey = requiredApiKey(), database = importClient();
  const video = (await getYouTubeVideos(apiKey, [videoId]))[0];
  if (!video || !video.available || !video.embeddable || video.live) throw new Error("Film nie istnieje albo nie można go osadzić.");
  await saveChannel(database, { id: video.channelId, title: video.channelTitle });
  const { error: videoError } = await database.from("youtube_videos").upsert({
    youtube_video_id: video.videoId, youtube_channel_id: video.channelId,
    title: video.title, thumbnail_url: video.thumbnailUrl, channel_title: video.channelTitle,
    view_count: video.viewCount, published_at: video.publishedAt,
    duration_seconds: video.durationSeconds, is_embeddable: true,
    availability_status: "available", last_refreshed_at: new Date().toISOString(),
  }, { onConflict: "youtube_video_id" });
  assertDatabase(videoError, "Nie udało się zapisać filmu");
  const { error } = await database.from("artist_videos").upsert({
    artist_id: artistId, youtube_video_id: video.videoId, status: "approved",
    is_official: true, confidence_score: 1, match_evidence: { manuallyApproved: true },
    reviewed_by: adminId, reviewed_at: new Date().toISOString(), rejection_reason: null,
  }, { onConflict: "artist_id,youtube_video_id" });
  assertDatabase(error, "Nie udało się przypisać filmu do artysty");
}
