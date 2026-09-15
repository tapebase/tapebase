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
    return {
      type, title: performer.name, thumbnailUrl: performer.image_url,
      primaryArtistSpotifyId: performer.spotify_id, primaryArtistImageUrl: performer.image_url,
      review: reviewCatalogSubmission({ type, title: performer.name, coverUrl: performer.image_url }),
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
