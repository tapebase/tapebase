import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RelationshipState = {
  following: boolean;
  follows_you: boolean;
  blocked_by_you: boolean;
  blocked_you: boolean;
};

export type FollowingActivityItem = {
  actor_id: string;
  username: string;
  avatar_url: string | null;
  kind: "album_rating" | "artist_rating" | "comment" | "album_added";
  occurred_at: string;
  rating: number | null;
  content: string | null;
  target_title: string;
  target_slug: string;
  target_image_url: string | null;
  target_type: "album" | "artist";
};

const emptyRelationship: RelationshipState = {
  following: false,
  follows_you: false,
  blocked_by_you: false,
  blocked_you: false,
};

export async function getRelationshipState(targetUserId: string): Promise<RelationshipState> {
  const client = await createClient();
  const { data, error } = await client.rpc("user_relationship_state", { target_user_id: targetUserId });
  if (error) throw new Error("Nie udało się pobrać relacji z użytkownikiem.");
  if (!data || typeof data !== "object") return emptyRelationship;
  const state = data as Record<string, unknown>;
  return {
    following: state.following === true,
    follows_you: state.follows_you === true,
    blocked_by_you: state.blocked_by_you === true,
    blocked_you: state.blocked_you === true,
  };
}

export async function getFollowingActivity(limit = 30): Promise<FollowingActivityItem[]> {
  const client = await createClient();
  const { data, error } = await client.rpc("following_activity", { activity_limit: limit });
  if (error) throw new Error("Nie udało się pobrać aktywności obserwowanych użytkowników.");
  return ((data ?? []) as FollowingActivityItem[]).map(item => ({
    ...item,
    rating: item.rating === null ? null : Number(item.rating),
  }));
}
