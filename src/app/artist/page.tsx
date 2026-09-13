import Link from "next/link";
import { ArtistCard, Empty, Pagination, SearchForm } from "@/components/catalog";
import { listArtists, pageNumber, searchText, type SearchParams } from "@/lib/catalog";
import { countryFilter } from "@/lib/countries";

export const metadata = { title: "Artyści" };
export default async function ArtistsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = searchText(params.q), page = pageNumber(params.page), country = countryFilter(params.kraj);
  const artists = await listArtists(q, page, 20, country);
  const filterHref = (value: string) => `/artist?${new URLSearchParams({ ...(q ? { q } : {}), kraj: value })}`;
  return <main className="mx-auto w-full max-w-7xl px-6 py-12">
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-4xl font-black">Artyści</h1>
      <p className="mt-3 text-zinc-600">Wykonawcy i współautorzy wydawnictw w katalogu · {artists.count} {q ? "wyników" : "artystów"}</p>
      <nav aria-label="Pochodzenie artystów" className="mt-6 flex flex-wrap gap-3">
        {[["all", "Wszyscy"], ["PL", "Polska"], ["INT", "Zagranica"]].map(([value, label]) => <Link key={value} href={filterHref(value)} aria-current={country === value ? "page" : undefined} className={`rounded-xl border px-4 py-2 text-sm font-bold ${country === value ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}>{label}</Link>)}
      </nav>
      <SearchForm action="/artist" query={q} label="Szukaj po nazwie artysty…" hidden={{ kraj: country }} />
      {artists.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{artists.rows.map(artist => <ArtistCard key={artist.id} artist={artist} />)}</div>
        : <Empty>{q ? "Nie znaleziono artystów. Spróbuj innej nazwy." : "Brak artystów na tej stronie."}</Empty>}
      <Pagination path="/artist" page={page} count={artists.count} query={q} other={{ kraj: country }} />
    </section>
  </main>;
}
