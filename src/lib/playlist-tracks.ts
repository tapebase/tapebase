import "server-only";

import { catalogClient } from "@/lib/supabase";
import { pageSize } from "@/lib/catalog";
import type { UserListTrack } from "@/lib/user-lists";

type Related<T> = T | T[] | null;
type RawTrack = Omit<UserListTrack, "album" | "credits"> & {
  album: Related<{ id: number; title: string; slug: string; cover_url: string | null }>;
  credits: { position: number; artist: Related<{ id: number; name: string | null; slug: string | null }> }[] | null;
};

function one<T>(value: Related<T>) { return Array.isArray(value) ? value[0] ?? null : value; }

export async function searchPlaylistTracks(query: string, page: number): Promise<{ rows: UserListTrack[]; count: number }> {
  const client = catalogClient();
  const offset = (page - 1) * pageSize;
  const matchResult = await client.rpc("search_playlist_track_ids", {
    search_query: query,
    result_offset: offset,
    result_limit: pageSize,
  });
  if (matchResult.error) throw new Error("Nie udało się wyszukać utworów.");
  const matches = (matchResult.data ?? []) as unknown as { track_id: number; total_count: number }[];
  if (!matches.length) return { rows: [], count: 0 };
  const ids = matches.map(item => Number(item.track_id));
  const { data, error } = await client.from("tracks")
    .select("id,title,spotify_id,album:albums(id,title,slug,cover_url),credits:spotify_track_artists(position,artist:artists(id,name,slug))")
    .in("id", ids).returns<RawTrack[]>();
  if (error) throw new Error("Nie udało się pobrać utworów.");
  const normalized: UserListTrack[] = (data ?? []).map(track => ({
    ...track,
    album: one(track.album),
    credits: (track.credits ?? []).flatMap(credit => {
      const artist = one(credit.artist);
      return artist ? [{ position: credit.position, artist }] : [];
    }).sort((a, b) => a.position - b.position),
  }));
  const byId = new Map(normalized.map(track => [track.id, track]));
  return {
    rows: ids.flatMap(id => byId.get(id) ?? []),
    count: Number(matches[0].total_count),
  };
}
