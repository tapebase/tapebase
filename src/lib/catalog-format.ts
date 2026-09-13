import type { Album, Artist, Credit } from "./catalog";

export const artistPath = (artist: Pick<Artist, "slug" | "id">) => `/artist/${encodeURIComponent(artist.slug || String(artist.id))}`;
export const albumPath = (album: Pick<Album, "slug">) => `/album/${encodeURIComponent(album.slug)}`;
export function orderedArtists(credits: Credit[], fallback?: Artist | null) {
  const artists = [...credits].sort((a, b) => a.position - b.position)
    .flatMap(credit => credit.artist ? [credit.artist] : []);
  return artists.length ? artists : fallback ? [fallback] : [];
}
export function releaseDate(album: Pick<Album, "release_date_raw" | "release_date_precision" | "release_date">) {
  const raw = album.release_date_raw || album.release_date;
  if (!raw) return "Data nieznana";
  if (album.release_date_precision === "year" || /^\d{4}$/.test(raw)) return raw.slice(0, 4);
  if (album.release_date_precision === "month" || /^\d{4}-\d{2}$/.test(raw)) {
    return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${raw.slice(0, 7)}-01T00:00:00Z`));
  }
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${raw.slice(0, 10)}T00:00:00Z`));
}
export function duration(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
