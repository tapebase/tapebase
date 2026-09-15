import { isPossibleAlbumEdition } from "./submission-moderation.ts";

export type CatalogReviewCandidate = {
  type: "artist" | "album";
  title: string;
  artistHasOwnRelease?: boolean;
  artistNameConflict?: boolean;
  spotifyAlbumType?: string;
  totalTracks?: number;
  coverUrl?: string | null;
  releaseDateRaw?: string;
};

export type ExistingAlbumForReview = { spotifyId: string; title: string };

export type CatalogAutoReview = {
  autoApprove: boolean;
  riskScore: number;
  reasons: string[];
  releaseKind: "album" | "ep" | null;
};

export function reviewCatalogSubmission(
  candidate: CatalogReviewCandidate,
  existingAlbums: ExistingAlbumForReview[] = [],
  submittedSpotifyId = "",
): CatalogAutoReview {
  if (candidate.type === "artist") {
    const reasons: string[] = [];
    let riskScore = 0;
    if (!candidate.coverUrl) {
      riskScore += 30;
      reasons.push("Spotify nie zwróciło zdjęcia artysty.");
    }
    if (!candidate.artistHasOwnRelease) {
      riskScore += 70;
      reasons.push("Nie znaleziono wydawnictwa, na którym zgłoszony artysta jest głównym wykonawcą.");
    }
    if (candidate.artistNameConflict) {
      riskScore += 90;
      reasons.push("W katalogu istnieje inny profil Spotify o tej samej nazwie.");
    }
    return {
      autoApprove: reasons.length === 0,
      riskScore: Math.min(100, riskScore),
      reasons,
      releaseKind: null,
    };
  }

  const reasons: string[] = [];
  let riskScore = 0;
  let releaseKind: "album" | "ep" = "album";
  if (candidate.spotifyAlbumType === "single") {
    releaseKind = "ep";
    riskScore += 60;
    reasons.push("Spotify oznacza wydawnictwo jako singiel; administrator musi potwierdzić, czy jest to EP.");
  } else if (candidate.spotifyAlbumType !== "album") {
    riskScore += 80;
    reasons.push("Spotify nie oznacza tej pozycji jako zwykłego albumu.");
  }
  if (!candidate.coverUrl) {
    riskScore += 25;
    reasons.push("Spotify nie zwróciło okładki.");
  }
  if (!candidate.totalTracks || candidate.totalTracks < 2) {
    riskScore += 30;
    reasons.push("Wydawnictwo ma mniej niż dwa utwory.");
  }
  if (candidate.releaseDateRaw) {
    const year = Number(candidate.releaseDateRaw.slice(0, 4));
    if (Number.isInteger(year) && year > new Date().getUTCFullYear()) {
      riskScore += 30;
      reasons.push("Data wydania wskazuje przyszły rok.");
    }
  }
  const possibleEdition = existingAlbums.find(album =>
    album.spotifyId !== submittedSpotifyId && isPossibleAlbumEdition(candidate.title, album.title));
  if (possibleEdition) {
    riskScore += 70;
    reasons.push(`Możliwa inna edycja albumu „${possibleEdition.title}”, który jest już w katalogu.`);
  }
  return {
    autoApprove: reasons.length === 0,
    riskScore: Math.min(100, riskScore),
    reasons,
    releaseKind,
  };
}
