import { notFound, redirect } from "next/navigation";
import { SpotifyAdminImport } from "@/components/spotify-admin-import";
import { AdminTabs } from "@/components/admin-tabs";
import { PersistentImportQueue, type ImportJobView } from "@/components/persistent-import-queue";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Import Spotify" };

export default async function AdminImportPage({ searchParams }: { searchParams: Promise<{ artists?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fimport");
  if (viewer.role !== "admin") notFound();
  const client = await createClient();
  const { data: jobs, error } = await client.from("catalog_import_jobs")
    .select("id,title,spotify_type,status,albums_total,albums_completed,error_message,retry_at,locked_until,items:catalog_import_items(id,title,status,error_message,retry_at,attempt_count)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Nie udało się pobrać kolejki importu.");
  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p>
      <h1 className="mt-2 text-4xl font-black">Import ze Spotify</h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Dodawaj do 20 artystów naraz, wybieraj albumy i importuj kompletne tracklisty bez terminala. Ponowny import aktualizuje dane po identyfikatorach Spotify i nie tworzy duplikatów.</p>
      <AdminTabs active="import" />
    </header>
    <PersistentImportQueue jobs={(jobs ?? []) as ImportJobView[]} />
    <SpotifyAdminImport initialArtists={(await searchParams).artists ?? ""} />
  </main>;
}
