import "server-only";
import { catalogClient } from "./supabase";
import { unstable_cache } from "next/cache";
import type { CountryFilter } from "./countries";
import type { MusicGenre } from "./genres";

export type Artist = {
  id: number; name: string | null; slug: string | null; spotify_id: string | null;
  image_url: string | null; description: string | null;
  country_code: string | null;
  catalog_visible: boolean;
  real_name: string | null; birth_date: string | null; birth_date_precision: string | null;
  birth_place: string | null;
  enrichment_field_sources: Record<string, unknown> | null;
};
export type ArtistDetail = Artist & { biography_author: { username: string } | null };
export type Credit = { position: number; artist: Artist | null };
export type Album = {
  id: number; title: string; slug: string; spotify_id: string | null;
  cover_url: string | null; release_date: string | null; release_date_raw: string | null;
  release_date_precision: string | null; album_type: string; genre: string; description: string | null;
  primary_artist: Artist | null; credits: Credit[];
};
export type RatedAlbum = Album & { average: number; ratingCount: number };
export type RatedAlbumCover = Album & { average: number; ratingCount: number };
export type RecentlyRatedAlbum = RatedAlbum & { recentRatingCount: number };
export type RatedArtist = Artist & { average: number; ratingCount: number };
export type Track = {
  id: number; title: string; spotify_id: string | null; disc_number: number;
  track_number: number; duration_ms: number | null; credits: Credit[];
};
export type Participation = {
  track: { id: number; title: string; album: { id: number; title: string; slug: string } | null } | null;
};
const artistFields = "id,name,slug,spotify_id,image_url,description,country_code,catalog_visible,real_name,birth_date,birth_date_precision,birth_place,enrichment_field_sources";
const albumFields = `id,title,slug,spotify_id,cover_url,release_date,release_date_raw,release_date_precision,album_type,genre,description,primary_artist:artists!albums_artist_id_fkey(${artistFields}),credits:album_artists(position,artist:artists(${artistFields}))`;
export const pageSize = 20;
export type SearchParams = Record<string, string | string[] | undefined>;
export function searchText(value: SearchParams[string]) {
  return (typeof value === "string" ? value : "").trim().slice(0, 100);
}
export function pageNumber(value: SearchParams[string]) {
  return typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
}
function pattern(q: string) { return `%${q.replace(/[\\%_]/g, "\\$&")}%`; }
function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw new Error("Nie udało się pobrać katalogu.");
  return result.data;
}
async function listAlbumsUncached(q = "", page = 1, limit = pageSize, genre: MusicGenre | "" = ""): Promise<{ rows: Album[]; count: number }> {
  const client = catalogClient();
  if (q) {
    const offset = (page - 1) * limit;
    const matchResult = await client.rpc("search_album_ids_filtered", {
      search_query: q, search_genre: genre || null, result_offset: offset, result_limit: limit,
    }).returns<{ album_id: number; total_count: number }[]>();
    const matches = checked(matchResult as unknown as {
      data: { album_id: number; total_count: number }[] | null;
      error: unknown;
    });
    if (!matches.length) {
      if (page > 1) return { rows: [], count: (await listAlbumsUncached(q, 1, 1, genre)).count };
      return { rows: [], count: 0 };
    }
    const result = await client.from("albums").select(albumFields)
      .in("id", matches.map(item => item.album_id)).returns<Album[]>();
    const rows = checked(result), byId = new Map(rows.map(album => [album.id, album]));
    return { rows: matches.flatMap(item => byId.get(item.album_id) ?? []), count: Number(matches[0].total_count) };
  }
  const query = client.from("albums").select(albumFields, { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (genre) query.eq("genre", genre);
  const result = await query.range((page - 1) * limit, page * limit - 1).returns<Album[]>();
  if (result.error?.code === "PGRST103" && page > 1) return { rows: [] as Album[], count: (await listAlbumsUncached(q, 1, 1, genre)).count };
  return { rows: checked(result), count: result.count ?? 0 };
}
export const listAlbums = unstable_cache(listAlbumsUncached, ["catalog-albums"], { revalidate: 60, tags: ["catalog"] });

async function listArtistsUncached(q = "", page = 1, limit = pageSize, region: CountryFilter = "all"): Promise<{ rows: Artist[]; count: number }> {
  let query = catalogClient().from("artists").select(artistFields, { count: "exact" })
    .eq("catalog_visible", true).order("name").order("id");
  if (q) query = query.ilike("name", pattern(q));
  if (region === "PL") query = query.eq("country_code", "PL");
  if (region === "INT") query = query.neq("country_code", "PL").not("country_code", "is", null);
  const result = await query.range((page - 1) * limit, page * limit - 1).returns<Artist[]>();
  if (result.error?.code === "PGRST103" && page > 1) return { rows: [] as Artist[], count: (await listArtistsUncached(q, 1, 1, region)).count };
  return { rows: checked(result), count: result.count ?? 0 };
}
export const listArtists = unstable_cache(listArtistsUncached, ["catalog-artists"], { revalidate: 60, tags: ["catalog"] });
export type AlbumRankingFilters = { year?: string; releaseType?: "album" | "ep"; genre?: MusicGenre; minVotes?: number; country?: CountryFilter };

async function topRatedAlbumsUncached(limit = 10, filters: AlbumRankingFilters = {}): Promise<RatedAlbum[]> {
  const client = catalogClient();
  let summaryQuery = client.from("album_rating_summary")
    .select("album_id,average,rating_count")
    .order("average", { ascending: false })
    .order("rating_count", { ascending: false })
    .order("album_id");
  if (filters.minVotes && filters.minVotes > 1) summaryQuery = summaryQuery.gte("rating_count", filters.minVotes);
  const ranked = checked(await summaryQuery.limit(1000));
  if (!ranked.length) return [];

  const albums = await client.from("albums").select(albumFields)
    .in("id", ranked.map(item => item.album_id))
    .returns<Album[]>();
  const byId = new Map(checked(albums).map(album => [album.id, album]));
  return ranked.flatMap(item => {
    const album = byId.get(item.album_id);
    const yearMatches = !filters.year || album?.release_date_raw?.slice(0, 4) === filters.year;
    const typeMatches = !filters.releaseType || album?.album_type === filters.releaseType;
    const genreMatches = !filters.genre || album?.genre === filters.genre;
    const countryMatches = !filters.country || filters.country === "all"
      || (filters.country === "PL" ? album?.primary_artist?.country_code === "PL" : Boolean(album?.primary_artist?.country_code && album.primary_artist.country_code !== "PL"));
    return album && yearMatches && typeMatches && genreMatches && countryMatches ? [{
      ...album,
      average: Number(item.average),
      ratingCount: Number(item.rating_count),
    }] : [];
  }).slice(0, limit);
}
export const topRatedAlbums = unstable_cache(topRatedAlbumsUncached, ["catalog-top-albums"], { revalidate: 60, tags: ["catalog", "ratings"] });

async function topRatedAlbumCoversUncached(limit = 100, filters: AlbumRankingFilters = {}): Promise<RatedAlbumCover[]> {
  const client = catalogClient();
  let summaryQuery = client.from("album_cover_rating_summary")
    .select("album_id,average,rating_count")
    .order("average", { ascending: false })
    .order("rating_count", { ascending: false })
    .order("album_id");
  if (filters.minVotes && filters.minVotes > 1) summaryQuery = summaryQuery.gte("rating_count", filters.minVotes);
  const ranked = checked(await summaryQuery.limit(1000));
  if (!ranked.length) return [];

  const albums = await client.from("albums").select(albumFields)
    .in("id", ranked.map(item => item.album_id))
    .not("cover_url", "is", null)
    .returns<Album[]>();
  const byId = new Map(checked(albums).map(album => [album.id, album]));
  return ranked.flatMap(item => {
    const album = byId.get(item.album_id);
    const yearMatches = !filters.year || album?.release_date_raw?.slice(0, 4) === filters.year;
    const typeMatches = !filters.releaseType || album?.album_type === filters.releaseType;
    const genreMatches = !filters.genre || album?.genre === filters.genre;
    const countryMatches = !filters.country || filters.country === "all"
      || (filters.country === "PL" ? album?.primary_artist?.country_code === "PL" : Boolean(album?.primary_artist?.country_code && album.primary_artist.country_code !== "PL"));
    return album && yearMatches && typeMatches && genreMatches && countryMatches ? [{
      ...album,
      average: Number(item.average),
      ratingCount: Number(item.rating_count),
    }] : [];
  }).slice(0, limit);
}
export const topRatedAlbumCovers = unstable_cache(topRatedAlbumCoversUncached, ["catalog-top-album-covers"], { revalidate: 60, tags: ["catalog", "ratings"] });

async function mostRatedRecentlyUncached(limit = 10, offset = 0): Promise<RecentlyRatedAlbum[]> {
  const client = catalogClient();
  const recent = checked(await client.from("recent_album_rating_summary")
    .select("album_id,recent_rating_count,average,rating_count")
    .order("recent_rating_count", { ascending: false })
    .order("average", { ascending: false })
    .order("rating_count", { ascending: false })
    .order("album_id")
    .range(offset, offset + limit - 1));
  if (!recent.length) return [];

  const albums = await client.from("albums").select(albumFields)
    .in("id", recent.map(item => item.album_id))
    .returns<Album[]>();
  const byId = new Map(checked(albums).map(album => [album.id, album]));
  return recent.flatMap(item => {
    const album = byId.get(item.album_id);
    return album ? [{
      ...album,
      average: Number(item.average),
      ratingCount: Number(item.rating_count),
      recentRatingCount: Number(item.recent_rating_count),
    }] : [];
  });
}
export const mostRatedRecently = unstable_cache(mostRatedRecentlyUncached, ["catalog-recently-rated-albums"], { revalidate: 60, tags: ["catalog", "ratings"] });

async function topRatedArtistsUncached(limit = 100, minVotes = 1, country: CountryFilter = "all"): Promise<RatedArtist[]> {
  const client = catalogClient();
  let summaryQuery = client.from("artist_rating_summary")
    .select("artist_id,average,rating_count")
    .order("average", { ascending: false })
    .order("rating_count", { ascending: false })
    .order("artist_id");
  if (minVotes > 1) summaryQuery = summaryQuery.gte("rating_count", minVotes);
  const ranked = checked(await summaryQuery.limit(1000));
  if (!ranked.length) return [];

  const artists = await client.from("artists").select(artistFields)
    .in("id", ranked.map(item => item.artist_id)).eq("catalog_visible", true)
    .returns<Artist[]>();
  const byId = new Map(checked(artists).map(artist => [artist.id, artist]));
  return ranked.flatMap(item => {
    const artist = byId.get(item.artist_id);
    const countryMatches = country === "all" || (country === "PL" ? artist?.country_code === "PL" : Boolean(artist?.country_code && artist.country_code !== "PL"));
    return artist && countryMatches ? [{
      ...artist,
      average: Number(item.average),
      ratingCount: Number(item.rating_count),
    }] : [];
  }).slice(0, limit);
}
export const topRatedArtists = unstable_cache(topRatedArtistsUncached, ["catalog-top-artists"], { revalidate: 60, tags: ["catalog", "ratings"] });

async function rankingMetadataUncached() {
  const client = catalogClient();
  const [albumVotes, artistVotes, coverVotes, dates] = await Promise.all([
    client.from("ratings").select("id", { count: "exact", head: true }),
    client.from("artist_ratings").select("id", { count: "exact", head: true }),
    client.from("album_cover_ratings").select("id", { count: "exact", head: true }),
    client.from("albums").select("release_date_raw").not("release_date_raw", "is", null).limit(1000),
  ]);
  if (albumVotes.error || artistVotes.error || coverVotes.error || dates.error) throw new Error("Nie udało się pobrać danych rankingów.");
  const catalogYears = [...new Set((dates.data ?? []).flatMap(item => {
    const year = item.release_date_raw?.slice(0, 4);
    return year && /^\d{4}$/.test(year) ? [year] : [];
  }))];
  const currentYear = new Date().getUTCFullYear();
  const years = [...new Set([
    ...Array.from({ length: currentYear - 1970 + 1 }, (_, index) => String(currentYear - index)),
    ...catalogYears,
  ])].sort((a, b) => b.localeCompare(a));
  return { albumVotes: albumVotes.count ?? 0, artistVotes: artistVotes.count ?? 0, coverVotes: coverVotes.count ?? 0, years };
}
export const rankingMetadata = unstable_cache(rankingMetadataUncached, ["ranking-metadata"], { revalidate: 60, tags: ["catalog", "ratings"] });
export async function getAlbum(slug: string) {
  const result = await catalogClient().from("albums").select(albumFields).eq("slug", slug).maybeSingle<Album>();
  if (result.error) throw new Error("Nie udało się pobrać albumu.");
  return result.data;
}
export async function getTracks(albumId: number) {
  // Read all pages: the Data API's default row limit must not truncate a tracklist.
  const tracks: Track[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await catalogClient().from("tracks")
      .select(`id,title,spotify_id,disc_number,track_number,duration_ms,credits:spotify_track_artists(position,artist:artists(${artistFields}))`)
      .eq("album_id", albumId).order("disc_number").order("track_number").range(offset, offset + 499).returns<Track[]>();
    const rows = checked(result);
    tracks.push(...rows);
    if (rows.length < 500) return tracks;
  }
}
export async function getArtist(slug: string) {
  const query = catalogClient().from("artists")
    .select(`${artistFields},biography_author:users!artists_biography_author_id_fkey(username)`);
  const result = await (/^\d{1,19}$/.test(slug) ? query.eq("id", slug) : query.eq("slug", slug)).maybeSingle<ArtistDetail>();
  if (result.error) throw new Error("Nie udało się pobrać artysty.");
  return result.data;
}
export async function artistAlbums(artistId: number, page = 1): Promise<{ rows: Album[]; count: number }> {
  const client = catalogClient(), offset = (page - 1) * pageSize;
  const idResult = await client.rpc("artist_album_ids", {
    requested_artist_id: artistId, result_offset: offset, result_limit: pageSize,
  }).returns<{ album_id: number; total_count: number }[]>();
  const matches = checked(idResult as unknown as {
    data: { album_id: number; total_count: number }[] | null;
    error: unknown;
  });
  if (!matches.length) {
    if (page > 1) return { rows: [], count: (await artistAlbums(artistId, 1)).count };
    return { rows: [], count: 0 };
  }
  const albumResult = await client.from("albums").select(albumFields)
    .in("id", matches.map(item => item.album_id)).returns<Album[]>();
  const albums = checked(albumResult), byId = new Map(albums.map(album => [album.id, album]));
  return {
    rows: matches.flatMap(item => byId.get(item.album_id) ?? []),
    count: Number(matches[0].total_count),
  };
}
export async function artistTracks(artistId: number, page = 1): Promise<{ rows: Participation[]; count: number }> {
  const result = await catalogClient().from("spotify_track_artists")
    .select("track:tracks(id,title,album:albums(id,title,slug))", { count: "exact" }).eq("artist_id", artistId)
    .order("track_id").range((page - 1) * pageSize, page * pageSize - 1).returns<Participation[]>();
  if (result.error?.code === "PGRST103" && page > 1) return { rows: [] as Participation[], count: (await artistTracks(artistId, 1)).count };
  return { rows: checked(result), count: result.count ?? 0 };
}

export async function allArtistTracks(artistId: number): Promise<{ rows: Participation[]; count: number }> {
  const rows: Participation[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const result = await catalogClient().from("spotify_track_artists")
      .select("track:tracks(id,title,album:albums(id,title,slug))", { count: offset === 0 ? "exact" : undefined })
      .eq("artist_id", artistId).order("track_id").range(offset, offset + batchSize - 1).returns<Participation[]>();
    const batch = checked(result);
    rows.push(...batch);
    if (batch.length < batchSize) return { rows, count: result.count ?? rows.length };
  }
}
