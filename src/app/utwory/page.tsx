import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getUserListById } from "@/lib/user-lists";
import { searchPlaylistTracks } from "@/lib/playlist-tracks";
import { pageNumber, searchText, type SearchParams } from "@/lib/catalog";
import { Artwork, Empty, Pagination, SearchForm } from "@/components/catalog";
import { albumPath } from "@/lib/catalog-format";
import { AddTrackToSelectedPlaylist } from "@/components/user-list-forms";

export const metadata = { title: "Dodaj utwory do playlisty", robots: { index: false, follow: false } };

export default async function PlaylistTracksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  const listId = Number(typeof params.lista === "string" ? params.lista : "");
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/utwory?lista=${listId || ""}`)}`);
  if (!Number.isSafeInteger(listId) || listId < 1) notFound();
  const playlist = await getUserListById(listId, true);
  if (!playlist || playlist.user_id !== viewer.id || playlist.kind !== "tracks") notFound();
  const q = searchText(params.q);
  const page = pageNumber(params.page);
  const tracks = await searchPlaylistTracks(q, page);
  const contained = new Set(playlist.trackItems.map(item => item.track.id));

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <Link href={`/lista/${playlist.id}`} className="text-sm font-bold hover:underline">← Wróć do playlisty</Link>
    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Dodajesz do playlisty</p>
      <h1 className="mt-1 text-3xl font-black">{playlist.name}</h1>
      <p className="mt-3 text-zinc-600">Wyszukaj tytuł utworu, albumu albo nazwę artysty.</p>
      <SearchForm action="/utwory" query={q} label="Szukaj utworu, albumu lub artysty…" hidden={{ lista: String(playlist.id) }} />
      {tracks.rows.length ? <ul className="space-y-3">{tracks.rows.map(track => <li key={track.id} className="flex items-center gap-4 rounded-2xl border border-zinc-100 p-3">
        {track.album ? <Link href={albumPath(track.album)} className="w-16 shrink-0"><Artwork src={track.album.cover_url} alt={`Okładka albumu ${track.album.title}`} /></Link> : <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />}
        <div className="min-w-0 flex-1">
          <p className="font-black">{track.title}</p>
          <p className="mt-1 text-sm text-zinc-500">{track.credits.map((credit, index) => <span key={credit.artist?.id ?? index}>{index > 0 && ", "}{credit.artist?.name ?? "Artysta"}</span>)}</p>
          {track.album && <Link href={albumPath(track.album)} className="mt-1 block truncate text-xs text-zinc-500 hover:underline">{track.album.title}</Link>}
        </div>
        <AddTrackToSelectedPlaylist trackId={track.id} listId={playlist.id} alreadyAdded={contained.has(track.id)} />
      </li>)}</ul> : <Empty>Nie znaleziono pasujących utworów.</Empty>}
      <Pagination path="/utwory" page={page} count={tracks.count} query={q} other={{ lista: String(playlist.id) }} />
    </section>
  </main>;
}
