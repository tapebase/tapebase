import Link from "next/link";
import { Artwork } from "@/components/catalog";
import { ExpandableList } from "@/components/expandable-list";
import type { UserList } from "@/lib/user-lists";

function ListCover({ list }: { list: UserList }) {
  const albums = (list.kind === "albums"
    ? list.albumItems.map(item => item.album)
    : list.trackItems.flatMap(item => item.track.album ? [item.track.album] : [])
  ).filter((album, index, all) => all.findIndex(candidate => candidate.id === album.id) === index).slice(0, 4);
  return <div className="grid aspect-square grid-cols-2 overflow-hidden rounded-xl bg-zinc-100">
    {albums.length ? <>{albums.map(album => <Artwork key={album.id} src={album.cover_url} alt={`Okładka albumu ${album.title}`} className="rounded-none" />)}
      {Array.from({ length: 4 - albums.length }, (_, index) => <div key={`empty-${index}`} className="border border-white/40 bg-zinc-100" />)}</>
      : <div className="col-span-2 flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-zinc-500">Pusta lista</div>}
  </div>;
}

export function UserListCards({ lists, initialVisible = 6 }: { lists: UserList[]; initialVisible?: number }) {
  return <ExpandableList initialVisible={initialVisible} moreLabel="Pokaż więcej list" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {lists.map(list => <li key={list.id} className="min-w-0 rounded-2xl border border-zinc-100 p-4">
      <Link href={`/lista/${list.id}`}><ListCover list={list} /><h3 className="mt-4 truncate text-lg font-black hover:underline">{list.name}</h3></Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{list.kind === "albums"
          ? `${list.albumItems.length} ${list.albumItems.length === 1 ? "album" : "albumów"}`
          : `${list.trackItems.length} ${list.trackItems.length === 1 ? "utwór" : "utworów"}`}</span>
        <span>{list.is_public ? "Publiczna" : "Prywatna"}</span>
      </div>
      {list.description && <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{list.description}</p>}
    </li>)}
  </ExpandableList>;
}

export function UserListsSection({ lists, own = false }: { lists: UserList[]; own?: boolean }) {
  if (!own && !lists.length) return null;
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Kolekcje</p><h2 className="mt-1 text-2xl font-black">{own ? "Twoje listy" : "Publiczne listy"}</h2></div>
      {own && <Link href="/listy" className="text-sm font-bold underline">Zarządzaj listami →</Link>}
    </div>
    {lists.length ? <UserListCards lists={lists} initialVisible={4} /> : <p className="mt-4 text-zinc-500">Nie masz jeszcze własnych list ani playlist.</p>}
  </section>;
}
