import "server-only";
import { albumPath, artistPath } from "@/lib/catalog-format";
import { createClient } from "@/lib/supabase/server";
import type { NotificationView } from "@/components/notifications-panel";

type SubmissionRow = { id: number; spotify_type: "artist" | "album"; spotify_id: string; rejection_reason: string | null };
type NotificationRow = {
  id: number; kind: NotificationView["kind"]; message: string; read_at: string | null; created_at: string;
  comment_id: number | null;
  submission: SubmissionRow | SubmissionRow[] | null;
};

const labels: Record<NotificationView["kind"], string> = {
  submission_approved: "Zaakceptowane",
  submission_imported: "Dodane do katalogu",
  submission_rejected: "Odrzucone",
  comment_reply: "Nowa odpowiedź",
  comment_like: "Nowe polubienie",
};

export async function getNotifications(userId: string, limit = 100): Promise<NotificationView[]> {
  const client = await createClient();
  const { data, error } = await client.from("notifications")
    .select("id,kind,message,read_at,created_at,comment_id,submission:catalog_submissions(id,spotify_type,spotify_id,rejection_reason)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Nie udało się pobrać powiadomień.");
  const rows = (data ?? []) as unknown as NotificationRow[];
  const submissions = rows.flatMap(row => {
    const submission = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    return submission ? [submission] : [];
  });
  const albumIds = submissions.filter(item => item.spotify_type === "album").map(item => item.spotify_id);
  const artistIds = submissions.filter(item => item.spotify_type === "artist").map(item => item.spotify_id);
  const commentIds = rows.flatMap(row => row.comment_id ? [row.comment_id] : []);
  const [albums, artists, comments] = await Promise.all([
    albumIds.length ? client.from("albums").select("spotify_id,slug").in("spotify_id", albumIds) : Promise.resolve({ data: [], error: null }),
    artistIds.length ? client.from("artists").select("id,spotify_id,slug").in("spotify_id", artistIds) : Promise.resolve({ data: [], error: null }),
    commentIds.length ? client.from("comments").select("id,album:albums(slug),artist:artists(id,slug)").in("id", commentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (albums.error || artists.error || comments.error) throw new Error("Nie udało się przygotować odnośników powiadomień.");
  const albumLinks = new Map((albums.data ?? []).map(album => [album.spotify_id, albumPath(album)]));
  const artistLinks = new Map((artists.data ?? []).map(artist => [artist.spotify_id, artistPath(artist)]));
  const commentLinks = new Map((comments.data ?? []).flatMap(comment => {
    const album = Array.isArray(comment.album) ? comment.album[0] : comment.album;
    const artist = Array.isArray(comment.artist) ? comment.artist[0] : comment.artist;
    const path = album ? albumPath(album) : artist ? artistPath(artist) : null;
    return path ? [[comment.id, `${path}#comment-${comment.id}`] as const] : [];
  }));
  return rows.map(row => {
    const submission = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    const catalogHref = submission?.spotify_type === "album" ? albumLinks.get(submission.spotify_id)
      : submission ? artistLinks.get(submission.spotify_id) : undefined;
    return {
      id: row.id, kind: row.kind, message: row.message, read_at: row.read_at, created_at: row.created_at,
      statusLabel: labels[row.kind], rejectionReason: row.kind === "submission_rejected" ? submission?.rejection_reason ?? null : null,
      href: row.comment_id ? commentLinks.get(row.comment_id) ?? "/powiadomienia"
        : row.kind === "submission_imported" && catalogHref ? catalogHref : `/zglos#zgloszenie-${submission?.id ?? ""}`,
    };
  });
}
