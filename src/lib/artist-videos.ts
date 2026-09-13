import "server-only";

import { catalogClient } from "@/lib/supabase";

export type ArtistVideo = {
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  channel_title: string;
  view_count: number;
  published_at: string | null;
};

export async function getArtistVideos(artistId: number, limit = 5): Promise<ArtistVideo[]> {
  const { data, error } = await catalogClient().rpc("artist_videos_for_profile", {
    target_artist_id: artistId,
    result_limit: Math.max(1, Math.min(5, Math.trunc(limit))),
  });
  if (error) throw new Error("Nie udało się pobrać teledysków artysty.");
  return (data ?? []) as unknown as ArtistVideo[];
}
