import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getOwnUserLists } from "@/lib/user-lists";
import { CreateUserListForm } from "@/components/user-list-forms";
import { UserListCards } from "@/components/user-lists";
import { spotifyConnectionStatus } from "@/lib/spotify-user";
import { disconnectUserSpotify } from "@/app/actions/spotify-playlists";

export const metadata = { title: "Twoje listy i playlisty", robots: { index: false, follow: false } };

export default async function UserListsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/listy");
  const [lists, spotify] = await Promise.all([
    getOwnUserLists(viewer.id),
    spotifyConnectionStatus(viewer.id),
  ]);

  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <CreateUserListForm />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Kolekcje</p><h2 className="mt-1 text-3xl font-black">Twoje listy</h2></div><span className="text-sm font-bold text-zinc-500">{lists.length}/50</span></div>
      {lists.length ? <UserListCards lists={lists} /> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Utwórz pierwszą listę. Albumy dodasz ze stron albumów, a pojedyncze utwory bezpośrednio z tracklist.</p>}
    </section>
    {spotify.connected && <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black">Połączone konto Spotify</h2>
      <p className="mt-2 text-sm text-zinc-500">Możesz eksportować playlisty utworów bezpośrednio na swoje konto.</p>
      <form action={disconnectUserSpotify}><button className="mt-4 text-sm font-bold text-red-700 hover:underline">Odłącz Spotify</button></form>
    </section>}
  </main>;
}
