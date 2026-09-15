import "server-only";

import { SpotifyClient, record } from "../../scripts/spotify/client.mts";
import { album, artist } from "../../scripts/spotify/model.mts";
import { importClient } from "../../scripts/spotify/writer.mts";
import { reviewCatalogSubmission, type CatalogAutoReview } from "@/lib/catalog-auto-review";
import type { SpotifySubmissionType } from "@/lib/catalog-submission-validation";

function spotifyClient() {
  return new SpotifyClient({
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    minIntervalMs: 400,
  });
}

function escapedLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export type InspectedCatalogSubmission = {
  type: SpotifySubmissionType;
  title: string;
  thumbnailUrl: string | null;
  primaryArtistSpotifyId: string | null;
  primaryArtistImageUrl: string | null;
  review: CatalogAutoReview;
};

export async function inspectCatalogSubmission(
  type: SpotifySubmissionType,
  spotifyId: string,
): Promise<InspectedCatalogSubmission> {
  const spotify = spotifyClient();
  if (type === "artist") {
    const performer = artist(await spotify.get(`artists/${spotifyId}`));
    if (performer.spotify_id !== spotifyId) throw new Error("Spotify zwróciło innego artystę niż wskazany.");
    const database = importClient();
    const [releaseResult, matchingArtists] = await Promise.all([
      spotify.get(`artists/${spotifyId}/albums?include_groups=album,single&market=PL&limit=10`),
      database.from("artists").select("spotify_id,name")
        .ilike("name", escapedLikePattern(performer.name)).neq("spotify_id", spotifyId).limit(20),
    ]);
    if (matchingArtists.error) throw new Error("Nie udało się sprawdzić konfliktów profilu artysty.");
    const releasePage = record(releaseResult);
    if (!Array.isArray(releasePage.items)) throw new Error("Spotify zwróciło nieprawidłową listę wydawnictw artysty.");
    const hasOwnRelease = releasePage.items.map(album).some(release =>
      release.artists[0]?.spotify_id === spotifyId
      && (release.spotify_album_type === "album" || release.spotify_album_type === "single"));
    const normalizedName = performer.name.trim().toLocaleLowerCase("pl-PL");
    const nameConflict = (matchingArtists.data ?? []).some(item =>
      item.name.trim().toLocaleLowerCase("pl-PL") === normalizedName);
    return {
      type, title: performer.name, thumbnailUrl: performer.image_url,
      primaryArtistSpotifyId: performer.spotify_id, primaryArtistImageUrl: performer.image_url,
      review: reviewCatalogSubmission({
        type, title: performer.name, coverUrl: performer.image_url,
        artistHasOwnRelease: hasOwnRelease, artistNameConflict: nameConflict,
      }),
    };
  }

  const raw = record(await spotify.get(`albums/${spotifyId}?market=PL`));
  const release = album(raw);
  if (release.spotify_id !== spotifyId) throw new Error("Spotify zwróciło inny album niż wskazany.");
  const primaryArtistId = release.artists[0]?.spotify_id;
  if (!primaryArtistId) throw new Error("Spotify nie zwróciło głównego wykonawcy albumu.");
  const performer = artist(await spotify.get(`artists/${primaryArtistId}`));
  if (performer.spotify_id !== primaryArtistId) {
    throw new Error("Spotify zwróciło innego wykonawcę niż wskazany przy albumie.");
  }
  const database = importClient();
  const { data: storedArtist, error: artistError } = await database.from("artists")
    .select("id").eq("spotify_id", primaryArtistId).maybeSingle();
  if (artistError) throw new Error("Nie udało się sprawdzić profilu wykonawcy w katalogu.");
  const existingAlbums = storedArtist
    ? await database.from("albums").select("spotify_id,title").eq("artist_id", storedArtist.id)
    : { data: [], error: null };
  if (existingAlbums.error) throw new Error("Nie udało się sprawdzić podobnych albumów w katalogu.");
  const review = reviewCatalogSubmission({
    type, title: release.title, spotifyAlbumType: release.spotify_album_type,
    totalTracks: release.total_tracks, coverUrl: release.cover_url,
    releaseDateRaw: release.release_date_raw,
  }, (existingAlbums.data ?? []).map(item => ({
    spotifyId: item.spotify_id ?? "", title: item.title,
  })), spotifyId);
  return {
    type, title: release.title, thumbnailUrl: release.cover_url,
    primaryArtistSpotifyId: performer.spotify_id, primaryArtistImageUrl: performer.image_url,
    review,
  };
}

export function automaticReviewNote(review: CatalogAutoReview) {
  if (review.autoApprove) return "Automatycznie zatwierdzone po sprawdzeniu danych w Spotify.";
  return `Automatyczna kontrola: ryzyko ${review.riskScore}/100. ${review.reasons.join(" ")}`;
}
