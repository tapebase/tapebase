import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewArtistEnrichmentAction, runArtistEnrichmentAction } from "./actions";

export const metadata = { title: "Dane artystów" };

type Candidate = {
  id: number;
  source: string;
  source_id: string;
  source_url: string;
  confidence: number;
  candidate_data: Record<string, unknown>;
  match_evidence: Record<string, unknown>;
  artist: { id: number; name: string | null; slug: string | null; spotify_id: string | null } | null;
};

const statusLabels: Record<string, string> = {
  pending: "Do sprawdzenia", running: "W trakcie", enriched: "Uzupełnieni",
  review: "Weryfikacja ręczna", not_found: "Brak dopasowania", failed: "Błąd",
};

function value(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "string" && data[key] ? String(data[key]) : "—";
}

export default async function AdminArtistsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fartysci");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const [artistsResult, candidatesResult] = await Promise.all([
    client.from("artists").select("enrichment_status").eq("catalog_visible", true),
    client.from("artist_enrichment_candidates")
      .select("id,source,source_id,source_url,confidence,candidate_data,match_evidence,artist:artists!artist_enrichment_candidates_artist_id_fkey(id,name,slug,spotify_id)")
      .eq("status", "pending").order("created_at").limit(100).returns<Candidate[]>(),
  ]);
  if (artistsResult.error || candidatesResult.error) throw new Error("Nie udało się pobrać stanu danych artystów.");
  const statuses = new Map<string, number>();
  for (const row of artistsResult.data ?? []) statuses.set(row.enrichment_status, (statuses.get(row.enrichment_status) ?? 0) + 1);
  const candidates = candidatesResult.data ?? [];

  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p>
      <h1 className="mt-2 text-4xl font-black">Dane artystów</h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Uzupełniaj profile z Wikidata i MusicBrainz. Dokładne identyfikatory Spotify są zatwierdzane automatycznie, a dopasowania po nazwie czekają na decyzję.</p>
      <AdminTabs active="artists" />
    </header>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><h2 className="text-2xl font-black">Automatyczne uzupełnianie</h2><p className="mt-2 text-sm text-zinc-500">Jedna seria sprawdza maksymalnie 10 profili i nie zmienia już uzupełnionych wartości.</p></div>
        <form action={runArtistEnrichmentAction} className="flex items-end gap-3">
          <label className="text-sm font-semibold">Liczba profili
            <select name="limit" defaultValue="5" className="mt-1 block rounded-xl border border-zinc-300 bg-white px-3 py-2"><option>1</option><option>5</option><option>10</option></select>
          </label>
          <button className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800">Uruchom serię</button>
        </form>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(statusLabels).map(([status, label]) => <div key={status} className="rounded-2xl bg-[#f6f4ef] p-4"><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-3xl font-black">{statuses.get(status) ?? 0}</p></div>)}
      </div>
    </section>

    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Kandydaci do weryfikacji</h2>
      <p className="mt-2 text-sm text-zinc-500">Zatwierdź tylko wtedy, gdy strona źródłowa bez wątpliwości opisuje właściwego wykonawcę.</p>
      {candidates.length ? <div className="mt-6 space-y-4">{candidates.map(candidate => <article key={candidate.id} className="rounded-2xl border border-zinc-200 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Profil TAPEBASE</p>
            <h3 className="mt-1 text-xl font-black">{candidate.artist?.name ?? "Nieznany artysta"}</h3>
            {candidate.artist?.slug && <Link href={`/artist/${candidate.artist.slug}`} className="mt-1 inline-block text-sm font-semibold underline">Otwórz profil</Link>}
          </div>
          <div className="lg:text-right"><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Kandydat</p><p className="mt-1 font-bold">{value(candidate.candidate_data, "name")}</p><a href={candidate.source_url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">{candidate.source}: {candidate.source_id}</a></div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-zinc-500">Opis</dt><dd>{value(candidate.candidate_data, "description")}</dd></div>
          <div><dt className="text-zinc-500">Prawdziwe imię</dt><dd>{value(candidate.candidate_data, "real_name")}</dd></div>
          <div><dt className="text-zinc-500">Data urodzenia</dt><dd>{value(candidate.candidate_data, "birth_date")}</dd></div>
          <div><dt className="text-zinc-500">Miejsce</dt><dd>{value(candidate.candidate_data, "birth_place")}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <form action={reviewArtistEnrichmentAction}><input type="hidden" name="candidateId" value={candidate.id} /><button name="decision" value="approve" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Zatwierdź dopasowanie</button></form>
          <form action={reviewArtistEnrichmentAction}><input type="hidden" name="candidateId" value={candidate.id} /><button name="decision" value="reject" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Odrzuć</button></form>
        </div>
      </article>)}</div> : <p className="mt-6 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak kandydatów oczekujących na weryfikację.</p>}
    </section>
  </main>;
}
