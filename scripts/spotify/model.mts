import { record } from "./client.mts";

export function spotifyId(input: string, kind: "artist" | "album" = "artist"): string {
  let id = input.trim();
  if (id.startsWith(`spotify:${kind}:`)) id = id.slice(`spotify:${kind}:`.length);
  else if (id.startsWith("https://")) {
    const url = new URL(id);
    const match = url.pathname.match(new RegExp(`^/(?:intl-[a-zA-Z-]+/)?${kind}/([a-zA-Z0-9]{22})/?$`));
    if (url.hostname !== "open.spotify.com" || url.port || url.username || url.password || !match) {
      throw new Error(`Podaj Spotify ID lub link typu ${kind} z open.spotify.com.`);
    }
    id = match[1];
  }
  if (!/^[a-zA-Z0-9]{22}$/.test(id)) throw new Error(`Nieprawidłowy Spotify ID (${kind}).`);
  return id;
}

function str(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Spotify: brak nazwy lub wymaganego tekstu; podgląd przerwany.");
  return value;
}

function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) throw new Error("Spotify: nieprawidłowe dane liczbowe.");
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Spotify: brak wymaganej listy.");
  return value;
}

function image(value: unknown): string | null {
  const first = array(value)[0];
  if (!first) return null;
  const url = new URL(str(record(first).url));
  if (url.protocol !== "https:") throw new Error("Spotify: nieprawidłowy adres obrazu.");
  return url.href;
}

export function slug(name: string, id: string): string {
  const base = name.toLowerCase().replaceAll("ł", "l").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base.slice(0, 100) || "spotify"}-${id}`;
}

export function artistRef(value: unknown) {
  const data = record(value);
  const id = spotifyId(str(data.id));
  return { spotify_id: id, name: str(data.name), spotify_url: `https://open.spotify.com/artist/${id}` };
}

export function artist(value: unknown) {
  const data = record(value);
  const ref = artistRef(data);
  const spotify_genres = Array.isArray(data.genres)
    ? data.genres.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  return { ...ref, slug: slug(ref.name, ref.spotify_id), image_url: image(data.images), spotify_genres };
}

export function releaseDate(value: unknown, precision: unknown) {
  const raw = str(value);
  const patterns = { year: /^\d{4}$/, month: /^\d{4}-\d{2}$/, day: /^\d{4}-\d{2}-\d{2}$/ };
  if (precision !== "year" && precision !== "month" && precision !== "day") throw new Error("Spotify: nieznana dokładność daty.");
  const full = precision === "year" ? `${raw}-01-01` : precision === "month" ? `${raw}-01` : raw;
  const parsed = new Date(`${full}T00:00:00Z`);
  if (!patterns[precision].test(raw) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== full) {
    throw new Error("Spotify: nieprawidłowa data wydania.");
  }
  return { release_date: precision === "day" ? raw : null, release_date_raw: raw, release_date_precision: precision };
}

export function album(value: unknown) {
  const data = record(value);
  const id = spotifyId(str(data.id), "album");
  if (data.album_type !== "album" && data.album_type !== "single" && data.album_type !== "compilation") {
    throw new Error("Spotify: nieznany typ wydawnictwa.");
  }
  const artists = array(data.artists).map(artistRef);
  if (!artists.length) throw new Error("Spotify: wydawnictwo bez artysty.");
  const title = str(data.name);
  return {
    spotify_id: id, title, slug: slug(title, id), spotify_url: `https://open.spotify.com/album/${id}`,
    spotify_album_type: data.album_type, artists, cover_url: image(data.images),
    ...releaseDate(data.release_date, data.release_date_precision), total_tracks: integer(data.total_tracks, 1),
  };
}

export function track(value: unknown) {
  const data = record(value);
  const id = str(data.id);
  if (!/^[a-zA-Z0-9]{22}$/.test(id) || data.is_local === true) throw new Error("Spotify: utwór bez stabilnego ID.");
  const artists = array(data.artists).map(artistRef);
  if (!artists.length) throw new Error("Spotify: utwór bez artysty.");
  return {
    spotify_id: id, title: str(data.name), spotify_url: `https://open.spotify.com/track/${id}`,
    track_number: integer(data.track_number, 1), disc_number: integer(data.disc_number, 1),
    duration_ms: integer(data.duration_ms), artists,
  };
}
