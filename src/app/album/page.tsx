import Link from "next/link";
import { AlbumCard, Empty, Pagination } from "@/components/catalog";
import { listAlbums, pageNumber, searchText, type SearchParams } from "@/lib/catalog";
import { MUSIC_GENRES, isMusicGenre } from "@/lib/genres";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Albumy",
  "Przeglądaj, wyszukuj i oceniaj albumy oraz EP. Filtruj katalog TAPEBASE według gatunku i odkrywaj muzykę.",
  "/album",
);
export default async function AlbumsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = searchText(params.q), page = pageNumber(params.page);
  const genre = isMusicGenre(params.gatunek) ? params.gatunek : "";
  const randomError = params.losowy === "blad";
  const albums = await listAlbums(q, page, undefined, genre);
  return <main className="mx-auto w-full max-w-7xl px-6 py-12">
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">Albumy</h1>
          <p className="mt-3 text-zinc-600">Albumy i EP w katalogu · {albums.count} {q || genre ? "wyników" : "wydawnictw"}</p>
        </div>
        <Link href="/album/losowy" prefetch={false} className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 font-bold transition hover:bg-zinc-100">
          Losuj album
        </Link>
      </div>
      {randomError && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Nie udało się teraz wylosować albumu. Spróbuj ponownie.</p>}
      <form action="/album" className="my-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]" role="search">
        <label><span className="sr-only">Szukaj po tytule albumu lub artyście</span><input type="search" name="q" defaultValue={q} placeholder="Szukaj po tytule albumu lub artyście…" maxLength={100} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4" /></label>
        <label><span className="sr-only">Gatunek</span><select name="gatunek" defaultValue={genre} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
          <option value="">Wszystkie gatunki</option>
          {MUSIC_GENRES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label>
        <button className="rounded-2xl bg-zinc-950 px-6 py-4 font-bold text-white">Pokaż</button>
      </form>
      {albums.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.rows.map(album => <AlbumCard key={album.id} album={album} />)}</div>
        : <Empty>{q || genre ? "Nie znaleziono albumów dla wybranych kryteriów." : "Brak albumów na tej stronie."}</Empty>}
      <Pagination path="/album" page={page} count={albums.count} query={q} other={{ gatunek: genre }} />
    </section>
  </main>;
}
