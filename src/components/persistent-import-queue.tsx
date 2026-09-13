"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryImportJob, runQueueBatch } from "@/app/admin/import/queue-actions";

export type ImportJobView = {
  id: number; title: string; spotify_type: "artist" | "album"; status: string;
  albums_total: number; albums_completed: number; error_message: string | null;
  retry_at: string | null; locked_until: string | null;
  items: { id: number; title: string; status: string; error_message: string | null; retry_at: string | null; attempt_count: number }[];
};

const statusLabel: Record<string, string> = {
  queued: "W kolejce", running: "W trakcie", waiting_quota: "Oczekuje na limit Spotify",
  completed: "Zakończone", completed_with_errors: "Zakończone z błędami", failed: "Błąd",
};

export function PersistentImportQueue({ jobs }: { jobs: ImportJobView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const active = jobs.filter(job => !["completed", "completed_with_errors"].includes(job.status));

  function runAll() {
    startTransition(async () => {
      let last = "";
      for (let batch = 0; batch < 50; batch++) {
        const result = await runQueueBatch();
        last = result.message;
        if (!result.hasMore || result.waitingQuota || result.processed === 0) break;
      }
      setMessage(last);
      router.refresh();
    });
  }

  return <section className="mt-6 rounded-3xl border-2 border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Trwała kolejka</p><h2 className="mt-1 text-2xl font-black">Zaakceptowane do importu</h2><p className="mt-2 text-sm text-zinc-500">Postęp i blokada każdego zadania są zapisywane w Supabase. Przerwany import wróci do kolejki po wygaśnięciu pięciominutowej blokady.</p></div>
      <button onClick={runAll} disabled={pending || active.length === 0} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "Przetwarzanie…" : "Uruchom kolejkę"}</button></div>
    {message && <p aria-live="polite" className="mt-4 text-sm font-semibold text-zinc-700">{message}</p>}
    {jobs.length ? <ul className="mt-5 space-y-3">{jobs.map(job => <li key={job.id} className="rounded-2xl border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{job.title}</strong><p className="mt-1 text-sm text-zinc-500">{job.spotify_type === "artist" ? "Artysta" : "Album"} · {statusLabel[job.status] ?? job.status}</p></div><span className="font-black">{job.albums_completed}/{job.albums_total || "?"}</span></div>
      {job.error_message && <p className="mt-2 text-sm text-red-700">{job.error_message}</p>}
      {job.retry_at && <p className="mt-2 text-sm font-semibold text-amber-800">Ponowienie po: {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(job.retry_at))}</p>}
      {job.items?.some(item => item.status === "failed" || item.error_message) && <details className="mt-3 rounded-xl bg-zinc-50 p-3"><summary className="cursor-pointer text-sm font-bold">Szczegóły albumów</summary><ul className="mt-3 space-y-2">{job.items.filter(item => item.status === "failed" || item.error_message).map(item => <li key={item.id} className="text-sm"><strong>{item.title}</strong> · {item.status === "failed" ? "błąd" : "wstrzymany"} · próba {item.attempt_count}{item.error_message && <span className="block text-red-700">{item.error_message}</span>}{item.retry_at && <span className="block text-amber-800">Ponowienie: {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(item.retry_at))}</span>}</li>)}</ul></details>}
      {(job.status === "failed" || job.status === "completed_with_errors") && <form action={retryImportJob} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="jobId" value={job.id} />{job.spotify_type === "album" && <select name="releaseKind" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"><option value="album">Album</option><option value="ep">EP</option></select>}<button className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-bold text-white">Ponów błędy</button></form>}
    </li>)}</ul> : <p className="mt-5 text-zinc-500">Brak zadań importu.</p>}
  </section>;
}
