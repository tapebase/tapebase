import "server-only";
import { randomUUID } from "node:crypto";
import { SpotifyClient, SpotifyLimitError } from "../../scripts/spotify/client.mts";
import {
  discover,
  previewDiscovery,
  previewAlbum,
  reviewDiscovery,
  type ReviewedSpotifyDiscovery,
} from "../../scripts/spotify/preview.mts";
import { prepareImport } from "../../scripts/spotify/payload.mts";
import { importClient, writeImport } from "../../scripts/spotify/writer.mts";
import type { AdminBatchImportInput } from "@/lib/spotify-admin-validation";
import type { MusicGenre } from "@/lib/genres";

export type BatchPreviewItem =
  | { artistId: string; result: ReviewedSpotifyDiscovery; error?: never }
  | { artistId: string; result?: never; error: string };

type PreviewCacheEntry = { adminId: string; expiresAt: number; items: BatchPreviewItem[] };
const globalCache = globalThis as typeof globalThis & {
  __tapebaseSpotifyPreviewCache?: Map<string, PreviewCacheEntry>;
};
const previewCache = globalCache.__tapebaseSpotifyPreviewCache ??= new Map();

function spotifyClient() {
  return new SpotifyClient({
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    minIntervalMs: 400,
  });
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Nie udało się pobrać danych artysty.";
}

function pausedMessage(error: SpotifyLimitError) {
  return error.reason === "QUOTA_EXCEEDED"
    ? "Wstrzymano: pula Development Mode jest wyczerpana."
    : `Wstrzymano po limicie Spotify${error.retryAfterSeconds ? `; ponów za około ${Math.ceil(error.retryAfterSeconds)} s` : ""}.`;
}

export async function createAdminBatchPreview(input: AdminBatchImportInput): Promise<BatchPreviewItem[]> {
  const client = spotifyClient();
  const items: BatchPreviewItem[] = [];
  const unmatchedEpIds = new Set(input.epIds);
  let stoppedForLimit = false;

  for (let index = 0; index < input.artistIds.length; index++) {
    const artistId = input.artistIds[index];
    try {
      const found = await discover(client, artistId, input.market);
      const artistEpIds = found.releases
        .filter(item => item.spotify_album_type === "single" && unmatchedEpIds.has(item.spotify_id))
        .map(item => item.spotify_id);
      artistEpIds.forEach(id => unmatchedEpIds.delete(id));
      items.push({ artistId, result: reviewDiscovery(found, new Set(artistEpIds)) });
    } catch (error) {
      items.push({ artistId, error: message(error) });
      if (error instanceof SpotifyLimitError) {
        stoppedForLimit = true;
        for (const pendingId of input.artistIds.slice(index + 1)) {
          items.push({ artistId: pendingId, error: pausedMessage(error) });
        }
        break;
      }
    }
  }
  if (unmatchedEpIds.size && !stoppedForLimit) {
    throw new Error(`Nie znaleziono wskazanych EP w dyskografiach tej kolejki: ${[...unmatchedEpIds].join(", ")}.`);
  }
  return items;
}

export async function createCachedAdminBatchPreview(adminId: string, input: AdminBatchImportInput) {
  const items = await createAdminBatchPreview(input);
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(key);
  }
  while (previewCache.size >= 10) previewCache.delete(previewCache.keys().next().value!);
  const token = randomUUID();
  previewCache.set(token, { adminId, expiresAt: now + 20 * 60_000, items });
  return { token, items };
}

export function readCachedAdminBatchPreview(adminId: string, token: string) {
  const entry = previewCache.get(token);
  if (!entry || entry.adminId !== adminId || entry.expiresAt <= Date.now()) {
    if (entry) previewCache.delete(token);
    throw new Error("Podgląd wygasł albo serwer został uruchomiony ponownie. Pobierz podgląd kolejki jeszcze raz.");
  }
  return entry.items;
}

export type BatchImportResult = {
  artistId: string;
  artistName: string;
  success: boolean;
  message: string;
};

export async function executeAdminBatchImport(
  previews: BatchPreviewItem[],
  selectedArtists: Set<string>,
  selectedAlbums: Set<string>,
  countryCodes = new Map<string, string>(),
  genres = new Map<string, MusicGenre>(),
): Promise<BatchImportResult[]> {
  const client = spotifyClient();
  const database = importClient();
  const results: BatchImportResult[] = [];
  const selectedItems = previews.filter(item => selectedArtists.has(item.artistId));

  for (let index = 0; index < selectedItems.length; index++) {
    const item = selectedItems[index];
    if (!item.result) {
      results.push({ artistId: item.artistId, artistName: item.artistId, success: false, message: item.error });
      continue;
    }
    const albumIds = new Set(item.result.eligible
      .filter(album => selectedAlbums.has(`${item.artistId}:${album.spotify_id}`))
      .map(album => album.spotify_id));
    if (!albumIds.size) {
      results.push({ artistId: item.artistId, artistName: item.result.artist.name, success: false, message: "Nie wybrano żadnego albumu." });
      continue;
    }
    try {
      const prepared = await previewDiscovery(client, item.result, {
        maxAlbums: albumIds.size,
        albumIds,
      });
      const status = await writeImport(prepareImport(prepared), database);
      const { error: countryError } = await database.from("artists").update({
        country_code: countryCodes.get(item.artistId) ?? "PL",
        catalog_visible: true,
      }).eq("spotify_id", item.artistId);
      if (countryError) throw new Error("Albumy zapisano, ale nie udało się przypisać kraju artyście.");
      const { error: genreError } = await database.from("albums").update({ genre: genres.get(item.artistId) ?? "rap" })
        .in("spotify_id", [...albumIds]);
      if (genreError) throw new Error("Albumy zapisano, ale nie udało się przypisać gatunku.");
      results.push({
        artistId: item.artistId,
        artistName: item.result.artist.name,
        success: true,
        message: `${status.albums} albumów i ${status.tracks} utworów.`,
      });
    } catch (error) {
      results.push({ artistId: item.artistId, artistName: item.result.artist.name, success: false, message: message(error) });
      if (error instanceof SpotifyLimitError) {
        for (const pending of selectedItems.slice(index + 1)) {
          results.push({
            artistId: pending.artistId,
            artistName: pending.result?.artist.name ?? pending.artistId,
            success: false,
            message: pausedMessage(error),
          });
        }
        break;
      }
    }
  }
  if (!results.length) throw new Error("Wybierz co najmniej jednego artystę i jego album.");
  return results;
}

export async function executeAdminAlbumImport(
  albumId: string,
  albumType: "album" | "ep",
  market = "PL",
  countryCode = "PL",
  genre: MusicGenre = "rap",
) {
  const prepared = await previewAlbum(spotifyClient(), albumId, market, albumType);
  const payload = prepareImport(prepared);
  const database = importClient();
  const result = await writeImport(payload, database);
  const primaryArtistId = payload.albums[0]?.artists[0];
  if (primaryArtistId) {
    const { error } = await database.from("artists").update({ country_code: countryCode }).eq("spotify_id", primaryArtistId);
    if (error) throw new Error("Album zapisano, ale nie udało się przypisać kraju głównemu artyście.");
  }
  const { error: genreError } = await database.from("albums").update({ genre }).eq("spotify_id", albumId);
  if (genreError) throw new Error("Album zapisano, ale nie udało się przypisać gatunku.");
  return result;
}
