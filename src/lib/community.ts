import "server-only";
import { catalogClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth";

export type CommunityComment = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  username: string;
  avatar_url: string | null;
  likeCount: number;
  likedByViewer: boolean;
  parentCommentId: number | null;
  children: CommunityComment[];
};

export type AlbumComment = CommunityComment;

export type AlbumCommunity = {
  average: number | null;
  ratingCount: number;
  coverAverage: number | null;
  coverRatingCount: number;
  comments: AlbumComment[];
};

export type ViewerAlbumState = {
  rating: number | null;
  coverRating: number | null;
  listened: boolean;
  wantToListen: boolean;
};

export type ArtistCommunity = {
  average: number | null;
  ratingCount: number;
  albumAverage: number | null;
  ratedAlbumCount: number;
  viewerRating: number | null;
  comments: CommunityComment[];
};

export type LatestComment = {
  id: number;
  content: string;
  createdAt: string;
  rating: number | null;
  author: { username: string; avatarUrl: string | null };
  target: { type: "album"; id: number; title: string; slug: string; imageUrl: string | null }
    | { type: "artist"; id: number; title: string; slug: string | null; imageUrl: string | null };
};

type CommentResult = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_comment_id: number | null;
  users: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
};

type LatestCommentResult = {
  id: number;
  user_id: string;
  album_id: number | null;
  artist_id: number | null;
  content: string;
  created_at: string;
  users: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
  albums: { id: number; title: string; slug: string; cover_url: string | null } | { id: number; title: string; slug: string; cover_url: string | null }[] | null;
  artists: { id: number; name: string; slug: string | null; image_url: string | null } | { id: number; name: string; slug: string | null; image_url: string | null }[] | null;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getLatestComments(limit = 6): Promise<LatestComment[]> {
  const client = catalogClient();
  const commentsResult = await client.from("comments")
    .select("id,user_id,album_id,artist_id,content,created_at,users!comments_user_id_fkey(username,avatar_url),albums(id,title,slug,cover_url),artists(id,name,slug,image_url)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (commentsResult.error) throw new Error("Nie udało się pobrać ostatnich komentarzy.");

  const comments = (commentsResult.data ?? []) as LatestCommentResult[];
  if (!comments.length) return [];
  const albumComments = comments.filter(comment => comment.album_id !== null);
  const ratingsResult = albumComments.length ? await client.from("ratings")
    .select("user_id,album_id,rating")
    .in("user_id", [...new Set(albumComments.map(comment => comment.user_id))])
    .in("album_id", [...new Set(albumComments.map(comment => comment.album_id!))])
    : { data: [], error: null };
  if (ratingsResult.error) throw new Error("Nie udało się pobrać ocen autorów komentarzy.");
  const ratings = new Map((ratingsResult.data ?? []).map(row => [`${row.user_id}:${row.album_id}`, Number(row.rating)]));

  return comments.flatMap(comment => {
    const author = relatedOne(comment.users);
    const album = relatedOne(comment.albums);
    const artist = relatedOne(comment.artists);
    const target = album
      ? { type: "album" as const, id: album.id, title: album.title, slug: album.slug, imageUrl: album.cover_url }
      : artist ? { type: "artist" as const, id: artist.id, title: artist.name, slug: artist.slug, imageUrl: artist.image_url } : null;
    return author && target ? [{
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      rating: comment.album_id ? ratings.get(`${comment.user_id}:${comment.album_id}`) ?? null : null,
      author: { username: author.username, avatarUrl: author.avatar_url },
      target,
    }] : [];
  });
}

export async function getAlbumCommunity(albumId: number, viewer: Viewer | null): Promise<AlbumCommunity> {
  const client = catalogClient();
  const [ratingsResult, coverRatingsResult, commentsResult] = await Promise.all([
    client.from("ratings").select("rating").eq("album_id", albumId),
    client.from("album_cover_rating_summary").select("average,rating_count").eq("album_id", albumId).maybeSingle(),
    getCommentRows("album", albumId),
  ]);

  if (ratingsResult.error) throw new Error("Nie udało się pobrać ocen.");
  if (coverRatingsResult.error) throw new Error("Nie udało się pobrać ocen okładki.");
  if (commentsResult.error) throw new Error("Nie udało się pobrać komentarzy.");
  const ratings = (ratingsResult.data ?? []).map(item => Number(item.rating));
  const commentRows = commentsResult.data;
  const comments = await buildCommentThreads(commentRows, viewer);

  return {
    average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
    ratingCount: ratings.length,
    coverAverage: coverRatingsResult.data ? Number(coverRatingsResult.data.average) : null,
    coverRatingCount: coverRatingsResult.data ? Number(coverRatingsResult.data.rating_count) : 0,
    comments,
  };
}

async function getCommentRows(target: "album" | "artist", targetId: number) {
  const column = target === "album" ? "album_id" : "artist_id";
  const result = await catalogClient().from("comments")
    .select("id,user_id,content,created_at,updated_at,parent_comment_id,users!comments_user_id_fkey(username,avatar_url)")
    .eq(column, targetId)
    .order("created_at", { ascending: false })
    .limit(100);
  return { data: (result.data as CommentResult[] | null) ?? [], error: result.error };
}

async function buildCommentThreads(commentRows: CommentResult[], viewer: Viewer | null) {
  const client = catalogClient();
  const commentIds = commentRows.map(comment => comment.id);
  const likesResult = commentIds.length
    ? await client.from("comment_likes").select("comment_id,user_id").in("comment_id", commentIds)
    : { data: [], error: null };
  if (likesResult.error) throw new Error("Nie udało się pobrać polubień komentarzy.");
  const likes = likesResult.data ?? [];
  const flatComments: CommunityComment[] = commentRows.map(comment => {
    const profile = Array.isArray(comment.users) ? comment.users[0] : comment.users;
    const commentLikes = likes.filter(like => like.comment_id === comment.id);
    return {
      id: comment.id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      username: profile?.username ?? "Użytkownik",
      avatar_url: profile?.avatar_url ?? null,
      likeCount: commentLikes.length,
      likedByViewer: viewer ? commentLikes.some(like => like.user_id === viewer.id) : false,
      parentCommentId: comment.parent_comment_id,
      children: [],
    };
  });
  const byId = new Map(flatComments.map(comment => [comment.id, comment]));
  const comments: CommunityComment[] = [];
  // Rows arrive newest first. Root discussions keep that order; replies are
  // displayed chronologically so a thread reads from top to bottom.
  for (const comment of flatComments) {
    const parent = comment.parentCommentId ? byId.get(comment.parentCommentId) : null;
    if (parent) parent.children.push(comment);
    else comments.push(comment);
  }
  for (const comment of flatComments) {
    comment.children.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  }

  return comments;
}

export async function getViewerAlbumState(albumId: number, viewer: Viewer | null): Promise<ViewerAlbumState> {
  if (!viewer) return { rating: null, coverRating: null, listened: false, wantToListen: false };
  const client = await createClient();
  const [rating, coverRating, listened, wanted] = await Promise.all([
    client.from("ratings").select("rating").eq("album_id", albumId).eq("user_id", viewer.id).maybeSingle(),
    client.from("album_cover_ratings").select("rating").eq("album_id", albumId).eq("user_id", viewer.id).maybeSingle(),
    client.from("listened").select("id").eq("album_id", albumId).eq("user_id", viewer.id).maybeSingle(),
    client.from("want_to_listen").select("id").eq("album_id", albumId).eq("user_id", viewer.id).maybeSingle(),
  ]);
  if (rating.error || coverRating.error || listened.error || wanted.error) throw new Error("Nie udało się pobrać Twojej aktywności.");
  return {
    rating: rating.data ? Number(rating.data.rating) : null,
    coverRating: coverRating.data ? Number(coverRating.data.rating) : null,
    listened: Boolean(listened.data),
    wantToListen: Boolean(wanted.data),
  };
}

export async function getArtistCommunity(artistId: number, viewer: Viewer | null): Promise<ArtistCommunity> {
  const publicClient = catalogClient();
  const viewerClient = viewer ? await createClient() : null;
  const [artistSummary, albumSummary, viewerRating, commentsResult] = await Promise.all([
    publicClient.from("artist_rating_summary")
      .select("average,rating_count")
      .eq("artist_id", artistId)
      .maybeSingle(),
    publicClient.from("artist_album_rating_summary")
      .select("average,rated_album_count")
      .eq("artist_id", artistId)
      .maybeSingle(),
    viewerClient
      ? viewerClient.from("artist_ratings").select("rating")
        .eq("artist_id", artistId).eq("user_id", viewer!.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getCommentRows("artist", artistId),
  ]);
  if (artistSummary.error || albumSummary.error || viewerRating.error || commentsResult.error) {
    throw new Error("Nie udało się pobrać ocen artysty.");
  }
  const comments = await buildCommentThreads(commentsResult.data, viewer);
  return {
    average: artistSummary.data ? Number(artistSummary.data.average) : null,
    ratingCount: artistSummary.data ? Number(artistSummary.data.rating_count) : 0,
    albumAverage: albumSummary.data ? Number(albumSummary.data.average) : null,
    ratedAlbumCount: albumSummary.data ? Number(albumSummary.data.rated_album_count) : 0,
    viewerRating: viewerRating.data ? Number(viewerRating.data.rating) : null,
    comments,
  };
}
