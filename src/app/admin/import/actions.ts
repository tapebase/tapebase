"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  createCachedAdminBatchPreview,
  executeAdminBatchImport,
  readCachedAdminBatchPreview,
  type BatchImportResult,
} from "@/lib/spotify-admin";
import { parseAdminBatchImportInput, parseBatchSelection, type AdminBatchImportInput } from "@/lib/spotify-admin-validation";
import { musicGenre, suggestMusicGenre, type MusicGenre } from "@/lib/genres";

export type ArtistPreview = {
  artistId: string;
  artistName: string;
  artistImage: string | null;
  releasesFound: number;
  albumsRemaining: number;
  tracksPrepared: number;
  albums: { spotifyId: string; title: string; date: string; type: string; tracks: number }[];
  excludedCount: number;
  suggestedGenre: MusicGenre;
  spotifyGenres: string[];
  error?: string;
};

export type ImportPreviewState = {
  message?: string;
  success?: boolean;
  input?: AdminBatchImportInput;
  previews?: ArtistPreview[];
  results?: BatchImportResult[];
  previewToken?: string;
};

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") throw new Error("Brak uprawnień administratora.");
  return viewer;
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operacja nie powiodła się.";
}

export async function previewSpotifyArtists(_state: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  try {
    const admin = await requireAdmin();
    const input = parseAdminBatchImportInput(formData);
    const { token, items } = await createCachedAdminBatchPreview(admin.id, input);
    const previews: ArtistPreview[] = items.map(item => {
      if (!item.result) return {
        artistId: item.artistId,
        artistName: item.artistId,
        artistImage: null,
        releasesFound: 0,
        albumsRemaining: 0,
        tracksPrepared: 0,
        albums: [],
        excludedCount: 0,
        suggestedGenre: input.genre,
        spotifyGenres: [],
        error: item.error,
      };
      const albums = item.result.eligible.slice(0, input.maxAlbums);
      return {
        artistId: item.artistId,
        artistName: item.result.artist.name,
        artistImage: item.result.artist.image_url,
        releasesFound: item.result.releases.length,
        albumsRemaining: Math.max(0, item.result.eligible.length - albums.length),
        tracksPrepared: albums.reduce((sum, album) => sum + album.total_tracks, 0),
        albums: albums.map(album => ({
          spotifyId: album.spotify_id,
          title: album.title,
          date: album.release_date_raw,
          type: album.album_type,
          tracks: album.total_tracks,
        })),
        excludedCount: item.result.review.length,
        suggestedGenre: item.result.artist.spotify_genres.length
          ? suggestMusicGenre(item.result.artist.spotify_genres)
          : input.genre,
        spotifyGenres: item.result.artist.spotify_genres,
      };
    });
    const ready = previews.filter(item => !item.error && item.albums.length > 0).length;
    return {
      success: ready > 0,
      message: `Podgląd gotowy: ${ready} z ${previews.length} artystów można importować.`,
      input,
      previews,
      previewToken: token,
    };
  } catch (error) {
    return { message: safeMessage(error) };
  }
}

export async function importSpotifyArtists(_state: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  try {
    const admin = await requireAdmin();
    const token = String(formData.get("previewToken") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error("Brak ważnego podglądu kolejki.");
    const previews = readCachedAdminBatchPreview(admin.id, token);
    const selection = parseBatchSelection(formData);
    const countryCodes = new Map([...selection.artists].map(artistId => {
      const code = String(formData.get(`countryCode-${artistId}`) ?? "PL").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) throw new Error("Nieprawidłowe pochodzenie artysty.");
      return [artistId, code] as const;
    }));
    const genres = new Map([...selection.artists].map(artistId => [
      artistId, musicGenre(formData.get(`genre-${artistId}`) ?? "rap"),
    ] as const));
    const results = await executeAdminBatchImport(previews, selection.artists, selection.albums, countryCodes, genres);
    revalidatePath("/");
    revalidatePath("/album");
    revalidatePath("/artist");
    revalidatePath("/rankingi");
    const completed = results.filter(item => item.success).length;
    const importedArtistIds = results.filter(item => item.success).map(item => item.artistId);
    if (importedArtistIds.length) {
      const client = await (await import("@/lib/supabase/server")).createClient();
      await client.from("catalog_submissions").update({
        status: "imported", moderator_id: admin.id, moderated_at: new Date().toISOString(),
      }).eq("spotify_type", "artist").eq("status", "approved").in("spotify_id", importedArtistIds);
      revalidatePath("/admin/zgloszenia");
      revalidatePath("/zglos");
    }
    return {
      success: completed === results.length,
      message: `Kolejka zakończona: ${completed} z ${results.length} artystów zaimportowano poprawnie.`,
      results,
    };
  } catch (error) {
    return { message: safeMessage(error) };
  }
}
