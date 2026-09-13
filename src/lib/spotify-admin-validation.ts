import { spotifyId } from "../../scripts/spotify/model.mts";
import { musicGenre, type MusicGenre } from "./genres.ts";

export type AdminBatchImportInput = {
  artistIds: string[];
  market: string;
  maxAlbums: number;
  epIds: string[];
  countryCode: string;
  genre: MusicGenre;
};

export function parseAdminBatchImportInput(formData: FormData): AdminBatchImportInput {
  const rawArtists = String(formData.get("artists") ?? "").split(/[\s,]+/).filter(Boolean);
  const artistIds = [...new Set(rawArtists.map(value => spotifyId(value)))];
  if (!artistIds.length) throw new Error("Podaj co najmniej jednego artystę.");
  if (artistIds.length > 20) throw new Error("Jedna kolejka może zawierać najwyżej 20 artystów.");

  const market = String(formData.get("market") ?? "PL").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) throw new Error("Rynek musi być dwuliterowym kodem kraju, np. PL.");
  const maxAlbums = Number(formData.get("maxAlbums") ?? 100);
  if (!Number.isSafeInteger(maxAlbums) || maxAlbums < 1 || maxAlbums > 100) {
    throw new Error("Limit albumów na artystę musi mieścić się w zakresie 1–100.");
  }
  const rawEpIds = String(formData.get("epIds") ?? "").split(/[\s,]+/).filter(Boolean);
  const epIds = [...new Set(rawEpIds.map(value => spotifyId(value, "album")))];
  if (epIds.length > 100) throw new Error("Jednorazowo można potwierdzić najwyżej 100 EP.");
  const countryCode = String(formData.get("countryCode") ?? "PL").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Pochodzenie musi być dwuliterowym kodem kraju.");
  const genre = musicGenre(formData.get("genre") ?? "rap");
  return { artistIds, market, maxAlbums, epIds, countryCode, genre };
}

export function parseBatchSelection(formData: FormData) {
  const artists = new Set(formData.getAll("selectedArtists").map(String).filter(value => /^[A-Za-z0-9]{22}$/.test(value)));
  const albums = new Set(formData.getAll("selectedAlbums").map(String).filter(value => /^[A-Za-z0-9]{22}:[A-Za-z0-9]{22}$/.test(value)));
  return { artists, albums };
}
