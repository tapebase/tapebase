import { notFound, redirect } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import {
  BiographyAdminBrowser,
  type BiographySubmission,
  type PublishedBiography,
} from "@/components/artist-biography-moderation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Biografie" };

export default async function AdminBiographiesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fbiografie");
  if (viewer.role !== "admin") notFound();

  const client = await createClient();
  const [submissionsResult, publishedResult] = await Promise.all([
    client.from("artist_biography_submissions")
      .select("id,content,created_at,artist:artists!artist_biography_submissions_artist_id_fkey(name,slug,description,enrichment_field_sources),author:users!artist_biography_submissions_user_id_fkey(username)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<BiographySubmission[]>(),
    client.from("artists")
      .select("id,name,slug,description,biography_updated_at,enrichment_field_sources,biography_author:users!artists_biography_author_id_fkey(username)")
      .not("description", "is", null)
      .order("biography_updated_at", { ascending: false, nullsFirst: false })
      .limit(500),
  ]);
  if (submissionsResult.error || publishedResult.error) throw new Error("Nie udało się pobrać biografii.");
  const published = (publishedResult.data ?? []).flatMap(item => (
    item.description && !item.enrichment_field_sources?.description
      ? [{
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        biography_updated_at: item.biography_updated_at,
        biography_author: Array.isArray(item.biography_author) ? item.biography_author[0] ?? null : item.biography_author,
      } satisfies PublishedBiography]
      : []
  ));

  return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Panel administratora</p>
      <h1 className="mt-2 text-4xl font-black">Moderacja biografii</h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Sprawdzaj biografie przesłane przez użytkowników przed opublikowaniem ich na profilach artystów.</p>
      <AdminTabs active="biographies" />
    </header>
    <div className="mt-6">
      <BiographyAdminBrowser submissions={submissionsResult.data ?? []} biographies={published} />
    </div>
  </main>;
}
