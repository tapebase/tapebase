import Link from "next/link";
import { Artwork, Empty } from "@/components/catalog";
import { RatingStars } from "@/components/community-controls";
import { rankingMetadata, topRatedAlbumCovers, topRatedAlbums, topRatedArtists } from "@/lib/catalog";
import { albumPath, artistPath, orderedArtists } from "@/lib/catalog-format";
import { countryFilter } from "@/lib/countries";
import { MUSIC_GENRES, genreLabel, isMusicGenre } from "@/lib/genres";

export const metadata = {
  title: "Rankingi",
  description: "Najlepiej oceniani artyści, albumy i okładki w społeczności TAPEBASE.",
};

function RatingSummary({ average, count }: { average: number; count: number }) {
  return <div className="shrink-0 text-right">
    <div className="flex items-baseline justify-end gap-1">
      <strong className="text-2xl font-black text-amber-600">{average.toFixed(1)}</strong>
      <span className="text-xs text-zinc-500">/ 10</span>
    </div>
    <div className="mt-1 hidden sm:block"><RatingStars value={average} size="small" label={`Średnia ${average.toFixed(1)} na 10`} /></div>
    <p className="mt-1 text-xs text-zinc-500">{count} {count === 1 ? "ocena" : "ocen"}</p>
  </div>;
}

type RankingsPageProps = {
  searchParams: Promise<{
    typ?: string | string[];
    rok?: string | string[];
    rodzaj?: string | string[];
    kraj?: string | string[];
    gatunek?: string | string[];
  }>;
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const params = await searchParams;
  const rankingType = params.typ === "artysci" || params.typ === "albumy" || params.typ === "okladki" ? params.typ : "wszystkie";
  const showArtists = rankingType === "wszystkie" || rankingType === "artysci";
  const showAlbums = rankingType === "wszystkie" || rankingType === "albumy";
  const showCovers = rankingType === "okladki";
  const albumFiltersEnabled = showAlbums || showCovers;
  const metadata = await rankingMetadata();
  const year = typeof params.rok === "string" && metadata.years.includes(params.rok) ? params.rok : "";
  const releaseType = params.rodzaj === "album" || params.rodzaj === "ep" ? params.rodzaj : "";
  const country = countryFilter(params.kraj);
  const genre = isMusicGenre(params.gatunek) ? params.gatunek : "";
  const albumFilters = {
    year,
    releaseType: releaseType || undefined,
    genre: genre || undefined,
    minVotes: 1,
    country,
  } as const;
  const [artists, albums, covers] = await Promise.all([
    showArtists ? topRatedArtists(100, 1, country) : Promise.resolve([]),
    showAlbums ? topRatedAlbums(100, albumFilters) : Promise.resolve([]),
    showCovers ? topRatedAlbumCovers(100, albumFilters) : Promise.resolve([]),
  ]);

  return <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
    <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Rankingi społeczności</p>
      <h1 className="mt-2 text-4xl font-black sm:text-5xl">
        {rankingType === "artysci" ? "Najlepiej oceniani artyści" : rankingType === "albumy" ? "Najlepiej oceniane albumy" : rankingType === "okladki" ? "Najlepiej oceniane okładki" : "Najlepiej oceniani"}
      </h1>
      <p className="mt-4 max-w-3xl text-zinc-600">Zestawienia powstają z ocen użytkowników TAPEBASE. Wyżej znajduje się lepsza średnia, a przy remisie większa liczba ocen.</p>
      <nav aria-label="Rodzaje rankingów" className="mt-6 flex flex-wrap gap-3">
        <Link href="/rankingi?typ=artysci" aria-current={rankingType === "artysci" ? "page" : undefined} className={`rounded-xl border px-5 py-3 font-bold ${rankingType === "artysci" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}>TOP artyści</Link>
        <Link href="/rankingi?typ=albumy" aria-current={rankingType === "albumy" ? "page" : undefined} className={`rounded-xl border px-5 py-3 font-bold ${rankingType === "albumy" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}>TOP albumy</Link>
        <Link href="/rankingi?typ=okladki" aria-current={rankingType === "okladki" ? "page" : undefined} className={`rounded-xl border px-5 py-3 font-bold ${rankingType === "okladki" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white"}`}>TOP okładki</Link>
      </nav>
      <form action="/rankingi" className="mt-6 grid gap-4 rounded-2xl bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="typ" value={rankingType === "wszystkie" ? "" : rankingType} />
        <label className="text-sm font-bold">Rok wydania
          <select name="rok" defaultValue={year} disabled={!albumFiltersEnabled} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 font-normal disabled:opacity-50">
            <option value="">Wszystkie lata</option>
            {metadata.years.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Rodzaj wydawnictwa
          <select name="rodzaj" defaultValue={releaseType} disabled={!albumFiltersEnabled} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 font-normal disabled:opacity-50">
            <option value="">Albumy i EP</option><option value="album">Album</option><option value="ep">EP</option>
          </select>
        </label>
        <label className="text-sm font-bold">Gatunek
          <select name="gatunek" defaultValue={genre} disabled={!albumFiltersEnabled} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 font-normal disabled:opacity-50">
            <option value="">Wszystkie gatunki</option>
            {MUSIC_GENRES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Pochodzenie
          <select name="kraj" defaultValue={country} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 font-normal">
            <option value="PL">Polska</option><option value="all">Polska i zagranica</option><option value="INT">Zagranica</option>
          </select>
        </label>
        <button className="self-end rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white">Zastosuj filtry</button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">Filtry roku, rodzaju wydawnictwa i gatunku dotyczą rankingów albumów oraz okładek.</p>
    </header>

    <div className={`mt-6 grid gap-6 ${showArtists && showAlbums ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>
      {showArtists && <section id="top-artysci" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ranking użytkowników</p><h2 className="mt-1 text-3xl font-black">TOP artyści</h2></div><span className="text-sm text-zinc-500">{artists.length} pozycji</span></div>
        {artists.length ? <ol className="mt-6 space-y-3">{artists.map((artist, index) => <li key={artist.id} className="grid grid-cols-[2rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-zinc-100 p-3">
          <span className="text-center text-lg font-black text-zinc-400">{index + 1}</span><Link href={artistPath(artist)}><Artwork src={artist.image_url} alt={`Zdjęcie: ${artist.name || "artysta"}`} /></Link><Link href={artistPath(artist)} className="min-w-0 truncate font-black hover:underline">{artist.name || "Artysta bez nazwy"}</Link><RatingSummary average={artist.average} count={artist.ratingCount} />
        </li>)}</ol> : <div className="mt-6"><Empty>Brak ocenionych artystów dla wybranego pochodzenia.</Empty></div>}
      </section>}
      {showAlbums && <section id="top-albumy" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ranking użytkowników</p><h2 className="mt-1 text-3xl font-black">TOP albumy</h2></div><span className="text-sm text-zinc-500">{albums.length} pozycji</span></div>
        {albums.length ? <ol className="mt-6 space-y-3">{albums.map((album, index) => <li key={album.id} className="grid grid-cols-[2rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-zinc-100 p-3">
          <span className="text-center text-lg font-black text-zinc-400">{index + 1}</span><Link href={albumPath(album)}><Artwork src={album.cover_url} alt={`Okładka albumu ${album.title}`} /></Link><div className="min-w-0"><Link href={albumPath(album)} className="block truncate font-black hover:underline">{album.title}</Link><p className="mt-1 truncate text-xs text-zinc-500">{orderedArtists(album.credits, album.primary_artist).map(artist => artist.name).filter(Boolean).join(", ") || "Wykonawca nieznany"} · {genreLabel(album.genre)}</p></div><RatingSummary average={album.average} count={album.ratingCount} />
        </li>)}</ol> : <div className="mt-6"><Empty>Brak ocenionych albumów dla wybranych filtrów.</Empty></div>}
      </section>}
      {showCovers && <section id="top-okladki" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ranking użytkowników</p><h2 className="mt-1 text-3xl font-black">TOP okładki</h2></div><span className="text-sm text-zinc-500">{covers.length} pozycji</span></div>
        {covers.length ? <ol className="mt-6 grid gap-5 sm:grid-cols-2">{covers.map((album, index) => <li key={album.id} className="relative min-w-0 rounded-2xl border border-zinc-100 p-4">
          <span className="absolute left-2 top-2 z-10 flex h-9 min-w-9 items-center justify-center rounded-full bg-zinc-950 px-2 font-black text-white shadow">{index + 1}</span>
          <Link href={albumPath(album)}><Artwork src={album.cover_url} alt={`Okładka albumu ${album.title}`} /><h3 className="mt-4 truncate text-lg font-black hover:underline">{album.title}</h3></Link>
          <p className="mt-1 truncate text-xs text-zinc-500">{orderedArtists(album.credits, album.primary_artist).map(artist => artist.name).filter(Boolean).join(", ") || "Wykonawca nieznany"} · {genreLabel(album.genre)}</p>
          <div className="mt-3"><RatingSummary average={album.average} count={album.ratingCount} /></div>
        </li>)}</ol> : <div className="mt-6"><Empty>Brak ocenionych okładek dla wybranych filtrów.</Empty></div>}
      </section>}
    </div>
  </main>;
}
