import { record } from "./client.mts";
import { album, artist, artistRef, track } from "./model.mts";

function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("Plan importu: brak wymaganej listy.");
  return value.map(record);
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Plan importu: brak wymaganego tekstu.");
  return value;
}

function unique<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    if (map.has(id)) throw new Error("Plan importu: powtórzony identyfikator lub pozycja.");
    map.set(id, item);
  }
  return map;
}

// Convert the reviewed preview to the versioned database contract. Reject broken
// references and incomplete tracklists before any network access or database write.
export function prepareImport(input: unknown) {
  const preview = record(input);
  if (preview.mode !== "preview-only" || preview.schema_version !== 1) {
    throw new Error("Nieobsługiwany format podglądu importu.");
  }
  const plan = record(preview.plan);
  const rawArtists = list(plan.artists), rawAlbums = list(plan.albums), rawTracks = list(plan.tracks);
  const albumEdges = list(plan.album_artists), trackEdges = list(plan.track_artists);
  if (!rawAlbums.length || rawAlbums.length > 100 || rawTracks.length > 10000 || rawArtists.length > 10000) {
    throw new Error("Plan musi zawierać 1–100 albumów, do 10000 utworów i wykonawców.");
  }
  const artists = rawArtists.map((value) => {
    const ref = artistRef({ id: value.spotify_id, name: value.name });
    const withImage = artist({ id: value.spotify_id, name: value.name,
      images: value.image_url == null ? [] : [{ url: value.image_url }] });
    return { spotify_id: ref.spotify_id, name: ref.name, slug: text(value.slug),
      ...(Object.hasOwn(value, "image_url") ? { image_url: withImage.image_url } : {}) };
  });
  const artistMap = unique(artists, (item) => item.spotify_id);
  unique(rawAlbums, (item) => text(item.spotify_id));
  const referenced = new Set<string>();
  let usedAlbumEdges = 0, usedTrackEdges = 0, usedTracks = 0;

  function credits(edges: Record<string, unknown>[]): string[] {
    if (!edges.length) throw new Error("Plan importu: brak wykonawców.");
    const ordered = [...edges].sort((a, b) => Number(a.position) - Number(b.position));
    const ids = ordered.map((edge, index) => {
      if (edge.position !== index + 1) throw new Error("Plan importu: nieprawidłowa kolejność wykonawców.");
      const id = text(edge.artist_spotify_id);
      if (!artistMap.has(id)) throw new Error("Plan importu: nierozwiązane odwołanie do artysty.");
      referenced.add(id);
      return id;
    });
    unique(ids, (id) => id);
    return ids;
  }

  const albums = rawAlbums.map((value) => {
    const id = text(value.spotify_id);
    const edges = albumEdges.filter((edge) => edge.album_spotify_id === id);
    const artistIds = credits(edges);
    usedAlbumEdges += edges.length;
    if (value.primary_artist_spotify_id !== artistIds[0]) throw new Error("Plan importu: niespójny główny artysta.");
    const parsed = album({ id, name: value.title, album_type: value.spotify_album_type,
      artists: artistIds.map((id) => ({ id, name: artistMap.get(id)!.name })),
      images: value.cover_url == null ? [] : [{ url: value.cover_url }],
      release_date: value.release_date_raw, release_date_precision: value.release_date_precision,
      total_tracks: value.total_tracks });
    if ((value.album_type !== "album" && value.album_type !== "ep") || parsed.spotify_album_type === "compilation" ||
        (parsed.spotify_album_type === "single" && value.album_type !== "ep") || parsed.release_date !== value.release_date) {
      throw new Error("Plan importu: nieprawidłowy typ wydawnictwa lub data.");
    }
    const songs = rawTracks.filter((song) => song.album_spotify_id === id);
    if (songs.length !== parsed.total_tracks) throw new Error("Plan importu: niepełna tracklista.");
    unique(songs, (song) => `${song.disc_number}:${song.track_number}`);
    const tracks = songs.map((song) => {
      const edges = trackEdges.filter((edge) => edge.album_spotify_id === id &&
        edge.disc_number === song.disc_number && edge.track_number === song.track_number);
      const artistIds = credits(edges);
      usedTrackEdges += edges.length;
      const parsed = track({ id: song.spotify_id, name: song.title, disc_number: song.disc_number,
        track_number: song.track_number, duration_ms: song.duration_ms,
        artists: artistIds.map((id) => ({ id, name: artistMap.get(id)!.name })) });
      return { spotify_id: parsed.spotify_id, title: parsed.title, disc_number: parsed.disc_number,
        track_number: parsed.track_number, duration_ms: parsed.duration_ms, artists: artistIds };
    }).sort((a, b) => a.disc_number - b.disc_number || a.track_number - b.track_number);
    usedTracks += songs.length;
    return { spotify_id: parsed.spotify_id, title: parsed.title, slug: text(value.slug),
      cover_url: parsed.cover_url, release_date: parsed.release_date, release_date_raw: parsed.release_date_raw,
      release_date_precision: parsed.release_date_precision, album_type: value.album_type as "album" | "ep",
      spotify_album_type: parsed.spotify_album_type, total_tracks: parsed.total_tracks, artists: artistIds, tracks };
  });
  if (usedTracks !== rawTracks.length || usedAlbumEdges !== albumEdges.length || usedTrackEdges !== trackEdges.length ||
      referenced.size !== artistMap.size) throw new Error("Plan importu: osierocone dane lub relacje.");
  return { version: 1, artists, albums };
}

export type ImportPayload = ReturnType<typeof prepareImport>;
