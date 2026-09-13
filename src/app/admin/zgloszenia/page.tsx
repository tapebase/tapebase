import { notFound, redirect } from "next/navigation";
import { CatalogSubmissionModeration, type AdminSubmission } from "@/components/catalog-submission-moderation";
import { AdminTabs } from "@/components/admin-tabs";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { albumPath, artistPath } from "@/lib/catalog-format";
import { isPossibleAlbumEdition } from "@/lib/submission-moderation";

export const metadata = { title: "Zgłoszenia katalogu" };

type Supporter = { submission_id: number; user: { username: string } | { username: string }[] | null };
type CatalogAlbum = { id: number; spotify_id: string | null; title: string; slug: string; album_type: string; release_date_raw: string | null };
type CatalogArtist = { id: number; spotify_id: string | null; name: string | null; slug: string | null };
type HistoryRow = {
  id: number; title: string; action: "approved" | "rejected" | "imported" | "release_kind_changed";
  release_kind: "album" | "ep" | null; rejection_reason: string | null; moderator_note: string | null;
  created_at: string; admin: { username: string } | { username: string }[] | null;
};

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ message?: string; success?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fzgloszenia");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const [submissionsResult, supportersResult, albumsResult, artistsResult, historyResult] = await Promise.all([
    client.from("catalog_submissions").select("id,spotify_type,spotify_id,spotify_url,title,thumbnail_url,status,moderator_note,rejection_reason,release_kind,country_code,genre,created_at").eq("status", "pending").order("created_at", { ascending: true }),
    client.from("catalog_submission_supporters").select("submission_id,user:users(username)"),
    client.from("albums").select("id,spotify_id,title,slug,album_type,release_date_raw"),
    client.from("artists").select("id,spotify_id,name,slug"),
    client.from("catalog_moderation_history").select("id,title,action,release_kind,rejection_reason,moderator_note,created_at,admin:users!catalog_moderation_history_admin_id_fkey(username)").order("created_at", { ascending: false }).limit(50),
  ]);
  if (submissionsResult.error || supportersResult.error || albumsResult.error || artistsResult.error || historyResult.error) throw new Error("Nie udało się pobrać kolejki zgłoszeń.");
  const supporters = (supportersResult.data ?? []) as Supporter[];
  const albums = (albumsResult.data ?? []) as CatalogAlbum[];
  const artists = (artistsResult.data ?? []) as CatalogArtist[];
  const submissions = (submissionsResult.data ?? []).map(item => {
    const rows = supporters.filter(row => row.submission_id === item.id);
    const exactAlbum = item.spotify_type === "album" ? albums.find(album => album.spotify_id === item.spotify_id) : undefined;
    const exactArtist = item.spotify_type === "artist" ? artists.find(artist => artist.spotify_id === item.spotify_id) : undefined;
    const possibleEditions = item.spotify_type === "album" ? albums
      .filter(album => album.spotify_id !== item.spotify_id && isPossibleAlbumEdition(item.title, album.title))
      .slice(0, 5)
      .map(album => ({ id: album.id, title: album.title, href: albumPath(album), kind: album.album_type, date: album.release_date_raw })) : [];
    return {
      ...item,
      exactMatch: exactAlbum ? { label: exactAlbum.title, href: albumPath(exactAlbum) }
        : exactArtist ? { label: exactArtist.name ?? "Artysta bez nazwy", href: artistPath(exactArtist) } : null,
      possibleEditions,
      supporters: rows.length,
      submitters: rows.flatMap(row => {
        const user = Array.isArray(row.user) ? row.user[0] : row.user;
        return user?.username ? [`@${user.username}`] : [];
      }),
    } as AdminSubmission;
  }).sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending") || b.supporters - a.supporters || a.created_at.localeCompare(b.created_at));

  const history = ((historyResult.data ?? []) as unknown as HistoryRow[]).map(item => {
    const admin = Array.isArray(item.admin) ? item.admin[0] : item.admin;
    return { ...item, adminName: admin?.username ?? "system" };
  });

  const feedback = await searchParams;
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p><h1 className="mt-2 text-4xl font-black">Zgłoszenia użytkowników</h1><p className="mt-4 max-w-3xl text-zinc-600">Akceptuj wartościowe pozycje, odrzucaj błędne linki i przekazuj zatwierdzonych artystów do importera Spotify.</p><AdminTabs active="submissions" /></header>
    {feedback.message && <p role="status" className={`mt-6 rounded-xl p-4 text-sm ${feedback.success === "1" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}
    <CatalogSubmissionModeration submissions={submissions} history={history} />
  </main>;
}
