import Link from "next/link";
import { listAlbums, listArtists, mostRatedRecently, searchText, type SearchParams } from "@/lib/catalog";
import { AlbumCard, ArtistCard, Artwork, Empty, SearchForm } from "@/components/catalog";
import { LatestComments } from "@/components/latest-comments";
import { albumPath } from "@/lib/catalog-format";
import { getLatestComments } from "@/lib/community";
import { getMostActiveUsers } from "@/lib/community-leaderboard";
import { ActiveUsers } from "@/components/active-users";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = searchText((await searchParams).q);
  const [albums, artists, recentlyRated, latestComments, activeUsers] = await Promise.all([
    listAlbums(q, 1, 6),
    q ? listArtists(q, 1, 6) : Promise.resolve(null),
    q ? Promise.resolve([]) : mostRatedRecently(10),
    q ? Promise.resolve([]) : getLatestComments(6),
    q ? Promise.resolve([]) : getMostActiveUsers(10, 30),
  ]);
  return <main>
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
        <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Oceniaj i odkrywaj albumy. Twórz własny i globalny ranking.</h1>
        <p className="mt-5 text-lg text-zinc-600">Album jest głównym bohaterem.</p>
        <SearchForm action="/" query={q} label="Szukaj albumu lub artysty…" />
      </div>
    </section>
    {!q && <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6" aria-labelledby="recently-rated-heading">
      <div className="min-w-0 overflow-hidden rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recently-rated-heading" className="text-2xl font-black">Najczęściej oceniane ostatnio</h2>
            <p className="mt-1 text-sm text-zinc-500">Aktywność z ostatnich 7 dni</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Top 10</span>
        </div>
        {recentlyRated.length ? <ol className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {recentlyRated.map((album, index) => <li key={album.id} className="relative min-w-0 overflow-hidden rounded-2xl border border-zinc-100 p-3 sm:p-4">
            <span className="absolute left-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950 px-2 text-sm font-black text-white shadow">{index + 1}</span>
            <Link href={albumPath(album)} aria-label={`Album: ${album.title}`} className="block min-w-0 max-w-full">
              <Artwork src={album.cover_url} alt={`Okładka albumu ${album.title}`} />
              <h3 className="mt-4 truncate font-black hover:underline">{album.title}</h3>
            </Link>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-amber-600">★ {album.average.toFixed(1)}</p>
              <p className="text-xs text-zinc-500">{album.recentRatingCount} {album.recentRatingCount === 1 ? "ocena" : "ocen"} w 7 dni</p>
            </div>
          </li>)}
        </ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">W ostatnich 7 dniach nie dodano jeszcze żadnej oceny.</p>}
      </div>
    </section>}
    <section id="ostatnio-dodane" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        {artists && <div className="mb-8">
          <h2 className="mb-4 text-2xl font-black">Artyści: {q}</h2>
          {artists.rows.length ? <div className="grid gap-4 sm:grid-cols-2">{artists.rows.map(artist => <ArtistCard key={artist.id} artist={artist} />)}</div>
            : <Empty>Nie znaleziono artystów pasujących do zapytania.</Empty>}
          <Link href={`/artist?q=${encodeURIComponent(q)}`} className="mt-5 inline-block text-sm font-semibold underline">Wszyscy pasujący artyści ({artists.count})</Link>
        </div>}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{q ? `Albumy: ${q}` : "Ostatnio dodane"}</h2>
          <Link href={`/album${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="text-sm font-semibold underline">Wszystkie albumy ({albums.count})</Link>
        </div>
        {albums.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.rows.map(album => <AlbumCard key={album.id} album={album} />)}</div>
          : <Empty>{q ? "Nie znaleziono albumów pasujących do zapytania." : "Nie ma jeszcze albumów w katalogu."}</Empty>}
      </div>
    </section>
    {!q && <ActiveUsers users={activeUsers} />}
    {!q && <LatestComments comments={latestComments} />}
  </main>;
}
