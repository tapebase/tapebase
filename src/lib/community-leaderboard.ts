import "server-only";

import { unstable_cache } from "next/cache";
import { catalogClient } from "@/lib/supabase";

export type ActiveUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  added_albums: number;
  biographies: number;
  reviews: number;
  ratings: number;
  activity_score: number;
};

export type RankedActiveUser = ActiveUser & {
  rank_position: number;
  position_change: number | null;
  is_new: boolean;
};

async function getMostActiveUsersUncached(limit = 5, days = 30): Promise<ActiveUser[]> {
  const { data, error } = await catalogClient().rpc("community_user_leaderboard", {
    period_days: days,
    result_limit: limit,
  });
  if (error) throw new Error("Nie udało się pobrać rankingu aktywnych użytkowników.");
  return ((data ?? []) as ActiveUser[]).map(user => ({
    ...user,
    added_albums: Number(user.added_albums),
    biographies: Number(user.biographies),
    reviews: Number(user.reviews),
    ratings: Number(user.ratings),
    activity_score: Number(user.activity_score),
  }));
}

export const getMostActiveUsers = unstable_cache(
  getMostActiveUsersUncached,
  ["community-most-active-users"],
  { revalidate: 60, tags: ["community", "catalog", "ratings"] },
);

async function getRankedActiveUsersUncached(limit = 100, days = 30): Promise<RankedActiveUser[]> {
  const { data, error } = await catalogClient().rpc("community_user_leaderboard_with_movement", {
    requested_period_days: days,
    result_limit: limit,
  });
  if (error) throw new Error("Nie udało się pobrać zmian pozycji użytkowników.");
  return ((data ?? []) as RankedActiveUser[]).map(user => ({
    ...user,
    added_albums: Number(user.added_albums),
    biographies: Number(user.biographies),
    reviews: Number(user.reviews),
    ratings: Number(user.ratings),
    activity_score: Number(user.activity_score),
    rank_position: Number(user.rank_position),
    position_change: user.position_change === null ? null : Number(user.position_change),
    is_new: Boolean(user.is_new),
  }));
}

export const getRankedActiveUsers = unstable_cache(
  getRankedActiveUsersUncached,
  ["community-ranked-active-users"],
  { revalidate: 60, tags: ["community", "catalog", "ratings"] },
);
