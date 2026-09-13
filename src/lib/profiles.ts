import "server-only";

import { catalogClient } from "@/lib/supabase";

type Related<T> = T | T[] | null;

export type PublicUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

export type ProfileAlbum = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
};

export type ProfileArtist = {
  id: number;
  name: string | null;
  slug: string | null;
  image_url: string | null;
};

export type ProfileAlbumRating = {
  rating: number;
  updated_at: string;
  album: ProfileAlbum;
};

export type ProfileArtistRating = {
  rating: number;
  updated_at: string;
  artist: ProfileArtist;
};

export type ProfileComment = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  album: Pick<ProfileAlbum, "id" | "title" | "slug">;
};

export type ProfileListened = {
  created_at: string;
  album: ProfileAlbum;
};

export type PublicProfileActivity = {
  profile: PublicUser;
  albumRatings: ProfileAlbumRating[];
  artistRatings: ProfileArtistRating[];
  comments: ProfileComment[];
  listened: ProfileListened[];
  ratingCount: number;
  commentCount: number;
  listenedCount: number;
  addedAlbumCount: number;
  averageRating: number | null;
};

function one<T>(value: Related<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type RawAlbumRating = { rating: number; updated_at: string; albums: Related<ProfileAlbum> };
type RawArtistRating = { rating: number; updated_at: string; artists: Related<ProfileArtist> };
type RawComment = { id: number; content: string; created_at: string; updated_at: string; albums: Related<Pick<ProfileAlbum, "id" | "title" | "slug">> };
type RawListened = { created_at: string; albums: Related<ProfileAlbum> };

async function profileActivity(profileResult: { data: PublicUser | null; error: unknown }): Promise<PublicProfileActivity | null> {
  if (profileResult.error) throw new Error("Nie udało się pobrać profilu użytkownika.");
  if (!profileResult.data) return null;
  const profile = profileResult.data;
  const client = catalogClient();
  const [albumRatingsResult, artistRatingsResult, commentsResult, listenedResult, addedAlbumsResult] = await Promise.all([
    client.from("ratings")
      .select("rating,updated_at,albums(id,title,slug,cover_url)", { count: "exact" })
      .eq("user_id", profile.id).order("updated_at", { ascending: false }),
    client.from("artist_ratings")
      .select("rating,updated_at,artists(id,name,slug,image_url)", { count: "exact" })
      .eq("user_id", profile.id).order("updated_at", { ascending: false }),
    client.from("comments")
      .select("id,content,created_at,updated_at,albums(id,title,slug)", { count: "exact" })
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100),
    client.from("listened")
      .select("created_at,albums(id,title,slug,cover_url)", { count: "exact" })
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100),
    client.rpc("imported_album_count", { profile_id: profile.id }),
  ]);
  if (albumRatingsResult.error || artistRatingsResult.error || commentsResult.error || listenedResult.error || addedAlbumsResult.error) {
    throw new Error("Nie udało się pobrać aktywności użytkownika.");
  }

  const albumRatings = ((albumRatingsResult.data ?? []) as RawAlbumRating[]).flatMap(row => {
    const album = one(row.albums);
    return album ? [{ rating: Number(row.rating), updated_at: row.updated_at, album }] : [];
  });
  const artistRatings = ((artistRatingsResult.data ?? []) as RawArtistRating[]).flatMap(row => {
    const artist = one(row.artists);
    return artist ? [{ rating: Number(row.rating), updated_at: row.updated_at, artist }] : [];
  });
  const comments = ((commentsResult.data ?? []) as RawComment[]).flatMap(row => {
    const album = one(row.albums);
    return album ? [{ id: row.id, content: row.content, created_at: row.created_at, updated_at: row.updated_at, album }] : [];
  });
  const listened = ((listenedResult.data ?? []) as RawListened[]).flatMap(row => {
    const album = one(row.albums);
    return album ? [{ created_at: row.created_at, album }] : [];
  });
  const ratingValues = [...albumRatings.map(row => row.rating), ...artistRatings.map(row => row.rating)];

  return {
    profile,
    albumRatings,
    artistRatings,
    comments,
    listened,
    ratingCount: (albumRatingsResult.count ?? albumRatings.length) + (artistRatingsResult.count ?? artistRatings.length),
    commentCount: commentsResult.count ?? comments.length,
    listenedCount: listenedResult.count ?? listened.length,
    addedAlbumCount: Number(addedAlbumsResult.data ?? 0),
    averageRating: ratingValues.length ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length : null,
  };
}

export async function getPublicProfileByUsername(username: string) {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return null;
  const result = await catalogClient().from("users")
    .select("id,username,avatar_url,created_at")
    .ilike("username", username)
    .maybeSingle<PublicUser>();
  return profileActivity(result);
}

export async function getPublicProfileById(id: string) {
  const result = await catalogClient().from("users")
    .select("id,username,avatar_url,created_at")
    .eq("id", id)
    .maybeSingle<PublicUser>();
  return profileActivity(result);
}
