import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfileById, type ProfileAlbum } from "@/lib/profiles";
import { ThemeSettings } from "@/components/theme-settings";
import { ProfileActivitySections, ProfileHero } from "@/components/profile-activity";
import { ProfileSettings } from "@/components/profile-settings";
import { Artwork } from "@/components/catalog";
import { albumPath } from "@/lib/catalog-format";

export const metadata = { title: "Twój profil" };

type RelatedAlbum = ProfileAlbum | ProfileAlbum[] | null;
type WantedRow = { created_at: string; albums: RelatedAlbum };

function relatedAlbum(value: RelatedAlbum) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/profil");
  const client = await createClient();
  const [activity, wantedResult] = await Promise.all([
    getPublicProfileById(viewer.id),
    client.from("want_to_listen")
      .select("created_at,albums(id,title,slug,cover_url)")
      .eq("user_id", viewer.id).order("created_at", { ascending: false }),
  ]);
  if (!activity || wantedResult.error) throw new Error("Nie udało się pobrać profilu.");
  const wanted = ((wantedResult.data ?? []) as WantedRow[]).flatMap(row => {
    const album = relatedAlbum(row.albums);
    return album ? [{ created_at: row.created_at, album }] : [];
  });

  return <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
    <ProfileHero activity={activity} email={viewer.email} own />
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <ProfileSettings username={activity.profile.username} avatarUrl={activity.profile.avatar_url} />
      <ThemeSettings />
    </div>
    <ProfileActivitySections activity={activity} />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Powiadomienia</h2><p className="mt-2 text-zinc-500">Decyzje dotyczące Twoich zgłoszeń są dostępne na osobnej stronie.</p><Link href="/powiadomienia" className="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Przejdź do powiadomień</Link></section>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-black">Chcę posłuchać</h2>
      {wanted.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{wanted.map(row => <li key={row.album.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-zinc-100 p-3">
        <Link href={albumPath(row.album)}><Artwork src={row.album.cover_url} alt={`Okładka albumu ${row.album.title}`} /></Link>
        <Link href={albumPath(row.album)} className="min-w-0 truncate font-bold hover:underline">{row.album.title}</Link>
      </li>)}</ul> : <p className="mt-4 text-zinc-500">Lista jest pusta.</p>}
    </section>
  </main>;
}
