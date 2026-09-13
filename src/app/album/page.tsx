import { AlbumCard, Empty, Pagination, SearchForm } from "@/components/catalog";
import { listAlbums, pageNumber, searchText, type SearchParams } from "@/lib/catalog";

export const metadata = { title: "Albumy" };
export default async function AlbumsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = searchText(params.q), page = pageNumber(params.page);
  const albums = await listAlbums(q, page);
  return <main className="mx-auto w-full max-w-7xl px-6 py-12">
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-4xl font-black">Albumy</h1>
      <p className="mt-3 text-zinc-600">Albumy i EP w katalogu · {albums.count} {q ? "wyników" : "wydawnictw"}</p>
      <SearchForm action="/album" query={q} label="Szukaj po tytule albumu…" />
      {albums.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.rows.map(album => <AlbumCard key={album.id} album={album} />)}</div>
        : <Empty>{q ? "Nie znaleziono albumów. Spróbuj innego tytułu." : "Brak albumów na tej stronie."}</Empty>}
      <Pagination path="/album" page={page} count={albums.count} query={q} />
    </section>
  </main>;
}
