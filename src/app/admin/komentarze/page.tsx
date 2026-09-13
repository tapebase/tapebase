import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { dismissCommentReportAction, moderateCommentAction } from "@/app/admin/actions";
import { getViewer } from "@/lib/auth";
import { albumPath } from "@/lib/catalog-format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Moderacja komentarzy" };
const reasonLabel = { spam: "Spam", abuse: "Obraźliwa treść", spoiler: "Spoiler", other: "Inny" };

type Relation<T> = T | T[] | null;
type Report = { id: number; category: keyof typeof reasonLabel; details: string | null; status: string; created_at: string; reporter: Relation<{ username: string }>; comment: Relation<{ id: number; content: string; hidden_at: string | null; hidden_reason: string | null; author: Relation<{ username: string }>; album: Relation<{ title: string; slug: string }> }> };

export default async function AdminCommentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fkomentarze");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const { data, error } = await client.from("comment_reports")
    .select("id,category,details,status,created_at,reporter:users!comment_reports_reporter_id_fkey(username),comment:comments(id,content,hidden_at,hidden_reason,author:users!comments_user_id_fkey(username),album:albums(title,slug))")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Nie udało się pobrać zgłoszeń komentarzy.");
  const reports = (data ?? []) as unknown as Report[];
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p><h1 className="mt-2 text-4xl font-black">Moderacja komentarzy</h1><p className="mt-4 text-zinc-600">Sprawdzaj zgłoszenia, ukrywaj treści i przywracaj komentarze bez usuwania danych.</p><AdminTabs active="comments" /></header>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      {reports.length ? <ol className="space-y-4">{reports.map(report => { const comment = Array.isArray(report.comment) ? report.comment[0] : report.comment; const reporter = Array.isArray(report.reporter) ? report.reporter[0] : report.reporter; if (!comment) return null; const author = Array.isArray(comment.author) ? comment.author[0] : comment.author; const album = Array.isArray(comment.album) ? comment.album[0] : comment.album; return <li key={report.id} className="rounded-2xl border border-zinc-200 p-5">
        <div className="flex flex-wrap justify-between gap-3"><p><strong>{reasonLabel[report.category]}</strong> · zgłosił @{reporter?.username ?? "Użytkownik"} · status: {report.status}</p>{album && <Link href={`${albumPath(album)}#comment-${comment.id}`} className="text-sm font-bold underline">Otwórz komentarz</Link>}</div>
        {report.details && <p className="mt-2 text-sm text-red-700">Opis zgłoszenia: {report.details}</p>}
        <blockquote className="mt-4 rounded-xl bg-zinc-50 p-4"><p className="text-xs font-bold text-zinc-500">@{author?.username ?? "Użytkownik"}</p><p className="mt-2 whitespace-pre-wrap break-words">{comment.content}</p>{comment.hidden_at && <p className="mt-2 text-sm font-bold text-red-700">Ukryty: {comment.hidden_reason}</p>}</blockquote>
        <div className="mt-4 flex flex-wrap gap-3">{comment.hidden_at ? <form action={moderateCommentAction}><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="moderationAction" value="restore" /><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Przywróć</button></form> : <form action={moderateCommentAction} className="flex flex-wrap gap-2"><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="moderationAction" value="hide" /><input name="reason" required maxLength={500} placeholder="Powód ukrycia" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" /><button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">Ukryj</button></form>}{report.status === "open" && <form action={dismissCommentReportAction}><input type="hidden" name="reportId" value={report.id} /><button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold">Odrzuć zgłoszenie</button></form>}</div>
      </li>;})}</ol> : <p className="text-zinc-500">Brak zgłoszonych komentarzy.</p>}
    </section>
  </main>;
}
