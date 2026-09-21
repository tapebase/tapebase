import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtist, artistAlbums, allArtistTracks, pageNumber, type SearchParams } from "@/lib/catalog";
import { AlbumCard, Artwork, Empty, Pagination } from "@/components/catalog";
import { albumPath, artistPath } from "@/lib/catalog-format";
import { getViewer } from "@/lib/auth";
import { getArtistCommunity } from "@/lib/community";
import { ArtistRatingPanel, RatingStars } from "@/components/community-controls";
import { ArtistConcerts } from "@/components/artist-concerts";
import { getArtistConcerts } from "@/lib/concerts";
import { countryLabel } from "@/lib/countries";
import { ArtistBiographyForm } from "@/components/artist-biography-form";
import { createClient } from "@/lib/supabase/server";
import { getArtistVideos } from "@/lib/artist-videos";
import { ArtistVideos } from "@/components/artist-videos";
import { ArtistCommunitySection } from "@/components/artist-community";
import { ArtistTrackList } from "@/components/artist-track-list";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_NAME } from "@/lib/seo";

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
  if (!artist) return { title: "Artysta", robots: { index: false, follow: true } };
  const path = artistPath(artist);
  const description = artist.description?.slice(0, 155)
    || `Profil artysty ${artist.name} w TAPEBASE: albumy, oceny, komentarze, utwory i teledyski.`;
  return {
    title: artist.name || "Artysta",
    description,
    alternates: artist.catalog_visible ? { canonical: path } : undefined,
    openGraph: {
      title: artist.name || "Artysta",
      description,
      url: path,
      type: "profile" as const,
      siteName: SITE_NAME,
      locale: "pl_PL",
      images: artist.image_url ? [{ url: artist.image_url, alt: `Zdjęcie artysty ${artist.name}` }] : [{ url: DEFAULT_SOCIAL_IMAGE, alt: "TAPEBASE – społecznościowa baza muzyki" }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: artist.name || "Artysta",
      description,
      images: artist.image_url ? [artist.image_url] : [DEFAULT_SOCIAL_IMAGE],
    },
    robots: artist.catalog_visible ? undefined : { index: false, follow: true },
  };
}
export default async function ArtistPage({ params, searchParams }: Props) {
  const artist = await getArtist((await params).slug);
  if (!artist) notFound();
  const search = await searchParams;
  const albumPage = pageNumber(search.albums);
  const viewer = await getViewer();
  const [albums, tracks, community, concerts, videos] = await Promise.all([
    artistAlbums(artist.id, albumPage),
    allArtistTracks(artist.id),
    getArtistCommunity(artist.id, viewer),
    getArtistConcerts(artist.id),
    getArtistVideos(artist.id),
  ]);
  let pendingBiography: { content: string } | null = null;
  if (viewer && artist.catalog_visible) {
    const client = await createClient();
    const result = await client.from("artist_biography_submissions")
      .select("content")
      .eq("artist_id", artist.id)
      .eq("user_id", viewer.id)
      .eq("status", "pending")
      .maybeSingle<{ content: string }>();
    if (result.error) throw new Error("Nie udało się pobrać Twojej propozycji biografii.");
    pendingBiography = result.data;
  }
  const returnPath = artistPath(artist);
  const age = ageFromBirthDate(artist.birth_date, artist.birth_date_precision);
  const birthLocation = [artist.country_code ? countryLabel(artist.country_code) : null, artist.birth_place].filter(Boolean).join(" / ") || "—";
  return <main className="mx-auto max-w-7xl px-6 py-12">
    {artist.catalog_visible && <JsonLd data={{
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "MusicGroup",
          "@id": `${absoluteUrl(returnPath)}#artist`,
          name: artist.name,
          url: absoluteUrl(returnPath),
          image: artist.image_url || undefined,
          description: artist.description || undefined,
          sameAs: artist.spotify_id ? [`https://open.spotify.com/artist/${artist.spotify_id}`] : undefined,
          album: albums.rows.map(album => ({ "@type": "MusicAlbum", name: album.title, url: absoluteUrl(albumPath(album)) })),
          aggregateRating: community.ratingCount > 0 && community.average !== null ? {
            "@type": "AggregateRating",
            ratingValue: Number(community.average.toFixed(1)),
            bestRating: 10,
            worstRating: 1,
            ratingCount: community.ratingCount,
          } : undefined,
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Artyści", item: absoluteUrl("/artist") },
            { "@type": "ListItem", position: 2, name: artist.name, item: absoluteUrl(returnPath) },
          ],
        },
      ],
    }} />}
    <Link href="/artist" className="mb-6 inline-block text-sm font-semibold hover:underline">← Wszyscy artyści</Link>
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <Artwork src={artist.image_url} alt={`Zdjęcie: ${artist.name || "artysta"}`} priority variant="artistProfile" />
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
          {(artist.real_name || artist.birth_date || artist.birth_place) && <dl className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 p-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="font-bold text-zinc-500">Imię i nazwisko</dt><dd className="mt-1 font-semibold">{artist.real_name ?? "—"}</dd></div>
            <div><dt className="font-bold text-zinc-500">Wiek</dt><dd className="mt-1 font-semibold">{ageLabel(age)}</dd></div>
            <div><dt className="font-bold text-zinc-500">Data urodzenia</dt><dd className="mt-1 font-semibold">{displayedBirthDate(artist.birth_date, artist.birth_date_precision)}</dd></div>
            <div><dt className="font-bold text-zinc-500">Miejsce urodzenia</dt><dd className="mt-1 font-semibold">{birthLocation}</dd></div>
          </dl>}
          {artist.description && !artist.enrichment_field_sources?.description && <div className="mt-6 max-w-3xl">
            <h2 className="text-2xl font-black">Biografia</h2>
            <p className="mt-3 whitespace-pre-line text-zinc-600">{artist.description}</p>
            {artist.biography_author && <p className="mt-3 text-sm text-zinc-500">Dodane przez <Link href={`/u/${encodeURIComponent(artist.biography_author.username)}`} className="font-bold text-zinc-700 hover:underline">@{artist.biography_author.username}</Link></p>}
          </div>}
          {artist.catalog_visible && (viewer
            ? <ArtistBiographyForm
              artistId={artist.id}
              hasBiography={Boolean(artist.description && !artist.enrichment_field_sources?.description)}
              hasPending={Boolean(pendingBiography)}
              initialContent={pendingBiography?.content ?? (!artist.enrichment_field_sources?.description ? artist.description ?? "" : "")}
            />
            : <p className="mt-6 rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-600"><Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="font-bold underline">Zaloguj się</Link>, aby zaproponować biografię artysty.</p>)}
        </div>
      </div>
    </section>
    <ArtistConcerts concerts={concerts} />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-3 text-2xl font-black">Albumy</h2>
      <p className="mb-6 text-sm text-zinc-500">Wydawnictwa dostępne w TAPEBASE. Katalog może nie obejmować całej dyskografii.</p>
      {albums.rows.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.rows.map(album => <AlbumCard key={album.id} album={album} />)}</div>
        : <Empty>Brak albumów tego artysty na tej stronie katalogu.</Empty>}
      <Pagination path={artistPath(artist)} page={albumPage} count={albums.count} pageKey="albums" />
    </section>
    <ArtistVideos videos={videos} />
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-3 text-2xl font-black">Utwory z udziałem</h2>
      <p className="mb-6 text-sm text-zinc-500">Wykonawcy według Spotify. Lista obejmuje także własne utwory artysty.</p>
      {tracks.rows.length ? <ArtistTrackList participations={tracks.rows} /> : <Empty>Brak utworów z udziałem tego artysty.</Empty>}
    </section>
    {artist.catalog_visible && <ArtistCommunitySection artistId={artist.id} comments={community.comments} viewer={viewer} returnPath={returnPath} />}
  </main>;
}
