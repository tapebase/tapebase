import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtist, artistAlbums, artistTracks, pageNumber, type SearchParams } from "@/lib/catalog";
import { AlbumCard, Artwork, Empty, Pagination } from "@/components/catalog";
import { albumPath, artistPath } from "@/lib/catalog-format";
import { getViewer } from "@/lib/auth";
import { getArtistCommunity } from "@/lib/community";
import { ArtistRatingPanel, RatingStars } from "@/components/community-controls";
import { ArtistConcerts } from "@/components/artist-concerts";
import { getArtistConcerts } from "@/lib/concerts";
import { countryLabel } from "@/lib/countries";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };
const birthDateFormat = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function ageFromBirthDate(value: string | null, precision: string | null) {
  if (!value || precision !== "day") return null;
  const birth = new Date(`${value}T00:00:00Z`), today = new Date();
  if (Number.isNaN(birth.valueOf()) || birth > today) return null;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function ageLabel(age: number | null) {
  if (age === null) return "—";
  if (age % 10 === 1 && age % 100 !== 11) return `${age} rok`;
  if ([2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100)) return `${age} lata`;
  return `${age} lat`;
}

function displayedBirthDate(value: string | null, precision: string | null) {
  if (!value) return "—";
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") return value.slice(0, 7);
  return birthDateFormat.format(new Date(`${value}T00:00:00Z`));
}
export async function generateMetadata({ params }: Props) {
  const artist = await getArtist((await params).slug);
  return {
    title: artist?.name || "Artysta",
    robots: artist?.catalog_visible ? undefined : { index: false, follow: true },
  };
}
export default async function ArtistPage({ params, searchParams }: Props) {
  const artist = await getArtist((await params).slug);
  if (!artist) notFound();
  const search = await searchParams;
  const albumPage = pageNumber(search.albums), trackPage = pageNumber(search.tracks);
  const viewer = await getViewer();
  const [albums, tracks, community, concerts] = await Promise.all([
    artistAlbums(artist.id, albumPage),
    artistTracks(artist.id, trackPage),
    getArtistCommunity(artist.id, viewer),
    getArtistConcerts(artist.id),
  ]);
  const returnPath = artistPath(artist);
  const age = ageFromBirthDate(artist.birth_date, artist.birth_date_precision);
  const birthLocation = [artist.country_code ? countryLabel(artist.country_code) : null, artist.birth_place].filter(Boolean).join(" / ") || "—";
  return <main className="mx-auto max-w-7xl px-6 py-12">
    <Link href="/artist" className="mb-6 inline-block text-sm font-semibold hover:underline">← Wszyscy artyści</Link>
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <Artwork src={artist.image_url} alt={`Zdjęcie: ${artist.name || "artysta"}`} priority className="w-56 shrink-0" />
        <div className="min-w-0"><h1 className="break-words text-4xl font-black sm:text-5xl">{artist.name || "Artysta bez nazwy"}</h1><div className="mt-2 flex flex-wrap gap-2"><p className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-600">{countryLabel(artist.country_code)}</p>{!artist.catalog_visible && <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">Profil techniczny</p>}</div>
          {!artist.catalog_visible && <p className="mt-4 max-w-2xl text-sm text-zinc-600">Ten wykonawca pojawił się w creditach utworów. Jego pełny profil i dyskografia nie zostały jeszcze zaimportowane.</p>}
          <div className="mt-2 grid gap-4 xl:grid-cols-2">
            <ArtistRatingPanel
              artistId={artist.id}
              average={community.average}
              ratingCount={community.ratingCount}
              initialRating={community.viewerRating}
              canRate={Boolean(viewer)}
              returnPath={returnPath}
            />
            <section className="mt-4 rounded-2xl bg-[#f6f4ef] p-5" aria-labelledby="artist-album-average">
              <p id="artist-album-average" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Średnia albumów artysty</p>
              <div className="mt-1 flex items-baseline gap-1"><strong className="text-4xl font-black">{community.albumAverage === null ? "—" : community.albumAverage.toFixed(1)}</strong><span className="text-sm text-zinc-500">/ 10</span></div>
              <div className="mt-2"><RatingStars value={community.albumAverage ?? 0} size="small" label={community.albumAverage === null ? "Brak ocen albumów" : `Średnia albumów ${community.albumAverage.toFixed(1)} na 10`} /></div>
              <p className="mt-3 text-sm text-zinc-500">{community.ratedAlbumCount} {community.ratedAlbumCount === 1 ? "oceniony album" : "ocenionych albumów"}</p>
            </section>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4"><p className="text-sm text-zinc-500">Albumy w katalogu</p><p className="text-4xl font-black">{albums.count}</p></div>
            <div className="rounded-2xl bg-[#f6f4ef] px-6 py-4"><p className="text-sm text-zinc-500">Utwory z udziałem</p><p className="text-4xl font-black">{tracks.count}</p></div>
          </div>
          {(artist.birth_date || artist.birth_place) && <dl className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 p-5 text-sm sm:grid-cols-3">
            <div><dt className="font-bold text-zinc-500">Wiek</dt><dd className="mt-1 font-semibold">{ageLabel(age)}</dd></div>
            <div><dt className="font-bold text-zinc-500">Data urodzenia</dt><dd className="mt-1 font-semibold">{displayedBirthDate(artist.birth_date, artist.birth_date_precision)}</dd></div>
            <div><dt className="font-bold text-zinc-500">Miejsce urodzenia</dt><dd className="mt-1 font-semibold">{birthLocation}</dd></div>
          </dl>}
          {artist.description && !artist.enrichment_field_sources?.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-zinc-600">{artist.description}</p>}
          {artist.enrichment_source_url && <p className="mt-3 text-xs text-zinc-400">Dane: <a href={artist.enrichment_source_url} target="_blank" rel="noreferrer" className="underline">{artist.enrichment_source === "wikidata" ? "Wikidata" : "MusicBrainz"}</a></p>}
        </div>
      </div>
    </section>
    <ArtistConcerts concerts={concerts} />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-3 text-2xl font-black">Albumy</h2>
      <p className="mb-6 text-sm text-zinc-500">Wydawnictwa dostępne w TAPEBASE. Katalog może nie obejmować całej dyskografii.</p>
      {albums.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.rows.map(album => <AlbumCard key={album.id} album={album} />)}</div>
        : <Empty>Brak albumów tego artysty na tej stronie katalogu.</Empty>}
      <Pagination path={artistPath(artist)} page={albumPage} count={albums.count} pageKey="albums" other={{ tracks: String(trackPage) }} />
    </section>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-3 text-2xl font-black">Utwory z udziałem</h2>
      <p className="mb-6 text-sm text-zinc-500">Wykonawcy według Spotify. Lista obejmuje także własne utwory artysty.</p>
      {tracks.rows.length ? <ul className="space-y-4">{tracks.rows.map(({ track }, index) => track && <li key={track.id || index} className="border-b border-zinc-100 pb-4">
        {track.album ? <Link href={`${albumPath(track.album)}#track-${track.id}`} className="font-semibold hover:underline">{track.title}<span className="mt-1 block text-sm font-normal text-zinc-500">{track.album.title}</span></Link> : track.title}
      </li>)}</ul> : <Empty>Brak utworów z udziałem tego artysty na tej stronie.</Empty>}
      <Pagination path={artistPath(artist)} page={trackPage} count={tracks.count} pageKey="tracks" other={{ albums: String(albumPage) }} />
    </section>
  </main>;
}
