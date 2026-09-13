import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { ConcertSyncPanel } from "@/components/concert-sync-panel";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Koncerty" };
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminConcertsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fkoncerty");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const now = new Date().toISOString();
  const [concertCount, offerCount, stateResult, runsResult] = await Promise.all([
    client.from("concerts").select("id", { count: "exact", head: true }).gte("starts_at", now),
    client.from("ticket_offers").select("id", { count: "exact", head: true }),
    client.from("concert_sync_state").select("last_artist_id,last_completed_at,last_error,updated_at").eq("id", true).maybeSingle(),
    client.from("concert_sync_runs").select("id,status,artists_checked,events_found,events_saved,error_message,started_at,finished_at").order("started_at", { ascending: false }).limit(20),
  ]);
  if (concertCount.error || offerCount.error || stateResult.error || runsResult.error) throw new Error("Nie udało się pobrać stanu synchronizacji koncertów.");
  const sync = stateResult.data;
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p>
      <h1 className="mt-2 text-4xl font-black">Koncerty i bilety</h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Automatycznie pobieraj polskie wydarzenia artystów z katalogu i pokazuj użytkownikom oficjalne odnośniki do biletów.</p>
      <AdminTabs active="concerts" />
    </header>
    <section className="my-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Nadchodzące koncerty</p><strong className="mt-1 block text-3xl">{concertCount.count ?? 0}</strong></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Oferty biletowe</p><strong className="mt-1 block text-3xl">{offerCount.count ?? 0}</strong></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">Ostatni pełny przebieg</p><strong className="mt-2 block text-sm">{sync?.last_completed_at ? date.format(new Date(sync.last_completed_at)) : "Jeszcze nie ukończono"}</strong></div>
    </section>
    <ConcertSyncPanel configured={Boolean(process.env.TICKETMASTER_API_KEY)} />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Historia synchronizacji</h2>
      {sync?.last_error && <p className="mt-4 rounded-xl bg-red-100 p-4 text-sm text-red-950">Ostatni błąd: {sync.last_error}</p>}
      {(runsResult.data ?? []).length ? <ol className="mt-5 space-y-3">{(runsResult.data ?? []).map(run => <li key={run.id} className="rounded-2xl border border-zinc-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><strong>{run.status === "completed" ? "Ukończono" : run.status === "running" ? "W trakcie" : "Błąd"}</strong><time className="text-sm text-zinc-500">{date.format(new Date(run.started_at))}</time></div>
        <p className="mt-2 text-sm text-zinc-600">Artyści: {run.artists_checked} · znalezione wydarzenia: {run.events_found} · zapisane: {run.events_saved}</p>
        {run.error_message && <p className="mt-2 text-sm text-red-700">{run.error_message}</p>}
      </li>)}</ol> : <p className="mt-4 text-zinc-500">Brak wykonanych synchronizacji.</p>}
    </section>
  </main>;
}
