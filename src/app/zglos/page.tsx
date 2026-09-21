import Image from "next/image";
import { redirect } from "next/navigation";
import { CatalogSubmissionForm } from "@/components/catalog-submission-form";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { genreLabel } from "@/lib/genres";

export const metadata = { title: "Zgłoś album lub artystę", robots: { index: false, follow: false } };

type ImportJob = { status: string; albums_total: number; albums_completed: number; error_message: string | null; retry_at: string | null };
type Submission = {
  id: number; spotify_type: "artist" | "album"; spotify_url: string; title: string;
  thumbnail_url: string | null; status: "pending" | "approved" | "rejected" | "imported";
  moderator_note: string | null; rejection_reason: string | null; release_kind: "album" | "ep" | null; created_at: string;
  country_code: string;
  genre: string;
  import_job: ImportJob | ImportJob[] | null;
};

const labels = { pending: "Oczekuje", approved: "Zaakceptowane", rejected: "Odrzucone", imported: "Dodane do katalogu" };

export default async function SubmitCatalogPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fzglos");
  const client = await createClient();
  const { data, error } = await client.from("catalog_submission_supporters")
    .select("created_at,submission:catalog_submissions(id,spotify_type,spotify_url,title,thumbnail_url,status,moderator_note,rejection_reason,release_kind,country_code,genre,created_at,import_job:catalog_import_jobs(status,albums_total,albums_completed,error_message,retry_at))")
    .eq("user_id", viewer.id).order("created_at", { ascending: false });
  if (error) throw new Error("Nie udało się pobrać Twoich zgłoszeń.");
  const submissions = (data ?? []).flatMap(row => {
    const value = Array.isArray(row.submission) ? row.submission[0] : row.submission;
    return value ? [value as unknown as Submission] : [];
  });

  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
    <CatalogSubmissionForm />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Twoje zgłoszenia</h2>
      {submissions.length ? <ul className="mt-5 space-y-3">{submissions.map(item => { const importJob = Array.isArray(item.import_job) ? item.import_job[0] : item.import_job; return <li id={`zgloszenie-${item.id}`} key={item.id} className="flex items-center gap-4 rounded-2xl border border-zinc-100 p-4">
        {item.thumbnail_url ? <Image src={item.thumbnail_url} alt="" width={64} height={64} unoptimized className={`h-16 w-16 shrink-0 object-contain ${item.spotify_type === "artist" ? "rounded-full" : "rounded-lg"}`} /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />}
        <div className="min-w-0 flex-1"><a href={item.spotify_url} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">{item.title}</a><p className="mt-1 text-sm text-zinc-500">{item.spotify_type === "artist" ? "Artysta" : item.release_kind === "ep" ? "EP" : "Album"} · {genreLabel(item.genre)} · {item.country_code === "PL" ? "Polska" : "Zagranica"} · {labels[item.status]}</p>{importJob && !["completed", "completed_with_errors"].includes(importJob.status) && <p className="mt-1 text-sm font-semibold text-emerald-700">Import: {importJob.albums_completed}/{importJob.albums_total || "?"} albumów{importJob.status === "waiting_quota" ? " · oczekuje na limit Spotify" : ""}{importJob.retry_at ? ` · ponowienie ${new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(new Date(importJob.retry_at))}` : ""}</p>}{item.rejection_reason && <p className="mt-1 text-sm text-red-700">Powód odrzucenia: {item.rejection_reason}</p>}{item.moderator_note && <p className="mt-1 text-sm text-zinc-600">{item.moderator_note}</p>}</div>
      </li>; })}</ul> : <p className="mt-4 text-zinc-500">Nie masz jeszcze żadnych zgłoszeń.</p>}
    </section>
  </main>;
}

