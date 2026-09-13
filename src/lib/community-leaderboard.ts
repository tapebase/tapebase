import "server-only";

import { unstable_cache } from "next/cache";
import { catalogClient } from "@/lib/supabase";

export type ActiveUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  added_albums: number;
  reviews: number;
  ratings: number;
  activity_score: number;
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
