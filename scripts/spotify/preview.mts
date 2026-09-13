import { SpotifyClient, record } from "./client.mts";
import { album, artist, slug, track, type artistRef } from "./model.mts";

export type PreviewOptions = { artistId: string; market: string; maxAlbums: number; epIds: Set<string> };
type Artist = ReturnType<typeof artist>;
type Release = ReturnType<typeof album>;

export type SpotifyDiscovery = {
  market: string;
  artist: Artist;
  releases: Release[];
};

export type ReviewedSpotifyDiscovery = SpotifyDiscovery & {
  eligible: Array<Release & { album_type: "album" | "ep" }>;
  review: Array<{
    spotify_id: string;
    title: string;
    spotify_url: string;
    spotify_album_type: string;
    total_tracks: number;
    release_date_raw: string;
    reason: string;
  }>;
};

export async function discover(client: SpotifyClient, artistId: string, market: string): Promise<SpotifyDiscovery> {
  const owner = artist(await client.get(`artists/${artistId}`));
  if (owner.spotify_id !== artistId) throw new Error("Spotify zwróciło innego artystę niż wskazany.");
  const listed = (await client.paginate(
    `artists/${artistId}/albums?include_groups=album,single&market=${market}&limit=10`,
  )).map(album);
  const releases = [...new Map(listed.map(item => [item.spotify_id, item])).values()];
  return { market, artist: owner, releases };
}

export function reviewDiscovery(discovery: SpotifyDiscovery, epIds: Set<string>): ReviewedSpotifyDiscovery {
  const { artist: owner, releases } = discovery;
  for (const id of epIds) {
    const match = releases.find(item => item.spotify_id === id);
    if (!match || !match.artists.some(ref => ref.spotify_id === owner.spotify_id) || match.spotify_album_type !== "single") {
      throw new Error(`EP ${id} nie występuje jako single w dyskografii tego artysty dla rynku ${discovery.market}.`);
    }
  }
  const eligible = releases
    .filter(item => item.artists.some(ref => ref.spotify_id === owner.spotify_id)
      && (item.spotify_album_type === "album" || epIds.has(item.spotify_id)))
    .map(item => ({ ...item, album_type: epIds.has(item.spotify_id) ? "ep" as const : "album" as const }))
    .sort((a, b) => a.spotify_id.localeCompare(b.spotify_id, "en"));
  return {
    ...discovery,
    eligible,
    review: releases
      .filter(item => !eligible.some(candidate => candidate.spotify_id === item.spotify_id))
      .map(item => ({
        spotify_id: item.spotify_id,
        title: item.title,
        spotify_url: item.spotify_url,
        spotify_album_type: item.spotify_album_type,
        total_tracks: item.total_tracks,
        release_date_raw: item.release_date_raw,
        reason: item.spotify_album_type === "single" ? "single_or_ep_requires_manual_decision" : "excluded_release",
      })),
  };
}

export async function previewDiscovery(
  client: SpotifyClient,
  discovery: ReviewedSpotifyDiscovery,
  options: { maxAlbums: number; albumIds?: Set<string> },
) {
  const { artist: owner, market } = discovery;
  const candidates = options.albumIds
    ? discovery.eligible.filter(item => options.albumIds!.has(item.spotify_id))
    : discovery.eligible;
  const selected = candidates.slice(0, options.maxAlbums);
  const albums = [];
  const tracks = [];
  const albumArtists: { album_spotify_id: string; artist_spotify_id: string; position: number }[] = [];
  const trackArtists: { album_spotify_id: string; disc_number: number; track_number: number; artist_spotify_id: string; position: number }[] = [];
  const artistMap = new Map<string, ReturnType<typeof artistRef> & { slug: string; image_url?: string | null }>();
  artistMap.set(owner.spotify_id, owner);
  function remember(ref: ReturnType<typeof artistRef>) {
    if (!artistMap.has(ref.spotify_id)) artistMap.set(ref.spotify_id, { ...ref, slug: slug(ref.name, ref.spotify_id) });
  }

  for (const summary of selected) {
    const raw = record(await client.get(`albums/${summary.spotify_id}?market=${market}`));
    const item = album(raw);
    if (item.spotify_id !== summary.spotify_id || !item.artists.some(ref => ref.spotify_id === owner.spotify_id)
        || (item.spotify_album_type !== "album" && !(item.spotify_album_type === "single" && summary.album_type === "ep"))) {
      throw new Error("Spotify: dane wydawnictwa zmieniły się podczas podglądu. Uruchom ponownie.");
    }
    const allTracks = (await client.paginate(
      `albums/${item.spotify_id}/tracks?market=${market}&limit=10`,
      raw.tracks,
    )).map(track);
    const positions = new Set<string>();
    for (const song of allTracks) {
      const position = `${song.disc_number}:${song.track_number}`;
      if (positions.has(position)) throw new Error(`Powtórzona pozycja ${position} w albumie ${item.spotify_id}.`);
      positions.add(position);
    }
    if (allTracks.length !== item.total_tracks) throw new Error(`Niepełna tracklista albumu ${item.spotify_id}; podgląd przerwany.`);
    allTracks.sort((a, b) => a.disc_number - b.disc_number || a.track_number - b.track_number);
    const { artists: refs, ...fields } = item;
    albums.push({ ...fields, album_type: summary.album_type, primary_artist_spotify_id: refs[0].spotify_id });
    refs.forEach((ref, position) => {
      remember(ref);
      albumArtists.push({ album_spotify_id: item.spotify_id, artist_spotify_id: ref.spotify_id, position: position + 1 });
    });
    for (const song of allTracks) {
      const { artists: contributors, ...fields } = song;
      tracks.push({ ...fields, album_spotify_id: item.spotify_id });
      contributors.forEach((ref, position) => {
        remember(ref);
        trackArtists.push({
          album_spotify_id: item.spotify_id,
          disc_number: song.disc_number,
          track_number: song.track_number,
          artist_spotify_id: ref.spotify_id,
          position: position + 1,
        });
      });
    }
  }
  return {
    mode: "preview-only" as const,
    schema_version: 1 as const,
    market,
    artist: owner,
    summary: {
      releases_found: discovery.releases.length,
      eligible_albums: discovery.eligible.length,
      albums_prepared: albums.length,
      albums_remaining: Math.max(0, candidates.length - albums.length),
      tracks_prepared: tracks.length,
      complete_for_eligible_albums: !options.albumIds && discovery.eligible.length === albums.length,
    },
    review: discovery.review,
    remaining_album_ids: candidates.slice(options.maxAlbums).map(item => item.spotify_id),
    plan: { artists: [...artistMap.values()], albums, tracks, album_artists: albumArtists, track_artists: trackArtists },
  };
}

export async function preview(client: SpotifyClient, options: PreviewOptions) {
  const found = await discover(client, options.artistId, options.market);
  const reviewed = reviewDiscovery(found, options.epIds);
  return previewDiscovery(client, reviewed, { maxAlbums: options.maxAlbums });
}

export async function previewAlbum(
  client: SpotifyClient,
  albumId: string,
  market: string,
  albumType: "album" | "ep",
) {
  const raw = record(await client.get(`albums/${albumId}?market=${market}`));
  const item = album(raw);
  if (item.spotify_id !== albumId) throw new Error("Spotify zwróciło inny album niż wskazany.");
  if ((albumType === "album" && item.spotify_album_type !== "album") ||
      (albumType === "ep" && item.spotify_album_type !== "single")) {
    throw new Error(albumType === "ep"
      ? "Wybrana pozycja nie jest oznaczona w Spotify jako single/EP."
      : "Spotify nie oznacza tej pozycji jako albumu. Wybierz EP, jeśli to krótsze wydawnictwo.");
  }
  const allTracks = (await client.paginate(
    `albums/${item.spotify_id}/tracks?market=${market}&limit=50`,
    raw.tracks,
  )).map(track).sort((a, b) => a.disc_number - b.disc_number || a.track_number - b.track_number);
  if (allTracks.length !== item.total_tracks) throw new Error("Spotify zwróciło niepełną tracklistę albumu.");
  const positions = new Set(allTracks.map(song => `${song.disc_number}:${song.track_number}`));
  if (positions.size !== allTracks.length) throw new Error("Spotify zwróciło powtórzone pozycje tracklisty.");

  const artists = new Map<string, ReturnType<typeof artistRef> & { slug: string }>();
  const remember = (ref: ReturnType<typeof artistRef>) => {
    if (!artists.has(ref.spotify_id)) artists.set(ref.spotify_id, { ...ref, slug: slug(ref.name, ref.spotify_id) });
  };
  item.artists.forEach(remember);
  allTracks.forEach(song => song.artists.forEach(remember));
  const { artists: albumCredits, ...albumFields } = item;
  return {
    mode: "preview-only" as const,
    schema_version: 1 as const,
    market,
    artist: artists.get(albumCredits[0].spotify_id),
    summary: {
      releases_found: 1, eligible_albums: 1, albums_prepared: 1,
      albums_remaining: 0, tracks_prepared: allTracks.length, complete_for_eligible_albums: true,
    },
    review: [],
    remaining_album_ids: [],
    plan: {
      artists: [...artists.values()],
      albums: [{ ...albumFields, album_type: albumType, primary_artist_spotify_id: albumCredits[0].spotify_id }],
      tracks: allTracks.map(({ artists: contributors, ...song }) => {
        if (!contributors.length) throw new Error("Spotify zwróciło utwór bez wykonawcy.");
        return { ...song, album_spotify_id: item.spotify_id };
      }),
      album_artists: albumCredits.map((ref, index) => ({ album_spotify_id: item.spotify_id, artist_spotify_id: ref.spotify_id, position: index + 1 })),
      track_artists: allTracks.flatMap(song => song.artists.map((ref, index) => ({
        album_spotify_id: item.spotify_id, disc_number: song.disc_number, track_number: song.track_number,
        artist_spotify_id: ref.spotify_id, position: index + 1,
      }))),
    },
  };
}
