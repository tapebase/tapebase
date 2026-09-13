import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlbum, getTracks } from "@/lib/catalog";
import { Artwork, ArtistLinks, Empty, SpotifyLink } from "@/components/catalog";
import { duration, orderedArtists, releaseDate } from "@/lib/catalog-format";
import { getViewer } from "@/lib/auth";
import { getAlbumCommunity, getViewerAlbumState } from "@/lib/community";
import { AlbumCommunitySection } from "@/components/album-community";
import { AlbumRatingPanel } from "@/components/community-controls";
import { genreLabel } from "@/lib/genres";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const album = await getAlbum((await params).slug);
  return { title: album?.title || "Nie znaleziono albumu" };
}
export default async function AlbumPage({ params }: Props) {
  const slug = (await params).slug;
  const album = await getAlbum(slug);
  if (!album) notFound();
  const viewer = await getViewer();
  const [tracks, community, viewerState] = await Promise.all([
    getTracks(album.id),
    getAlbumCommunity(album.id, viewer),
    getViewerAlbumState(album.id, viewer),
  ]);
  const discs = [...new Set(tracks.map(track => track.disc_number))];
  return <main className="mx-auto max-w-7xl px-6 py-12">
    <Link href="/album" className="mb-6 inline-block text-sm font-semibold hover:underline">← Wszystkie albumy</Link>
    <section className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside className="min-w-0">
        <Artwork src={album.cover_url} alt={`Okładka albumu ${album.title}`} priority className="mx-auto w-full max-w-80" />
        <AlbumRatingPanel
          albumId={album.id}
          average={community.average}
          ratingCount={community.ratingCount}
          initialRating={viewerState.rating}
          canRate={Boolean(viewer)}
          returnPath={`/album/${slug}`}
        />
        <div className="mt-4"><SpotifyLink type="album" id={album.spotify_id} /></div>
      </aside>
      <div className="min-w-0">
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-zinc-500">{album.album_type === "ep" ? "EP" : "Album"} · {genreLabel(album.genre)} · {releaseDate(album)}</p>
          <h1 className="break-words text-4xl font-black tracking-tight sm:text-5xl">{album.title}</h1>
          <p className="mt-3 text-xl font-semibold text-zinc-700"><ArtistLinks artists={orderedArtists(album.credits, album.primary_artist)} /></p>
          <p className="mt-6 text-sm text-zinc-500">Liczba utworów: {tracks.length}</p>
          {album.description && <p className="mt-6 whitespace-pre-line text-zinc-600">{album.description}</p>}
        </div>
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-2xl font-black">Tracklista</h2>
          {!tracks.length && <Empty>Tracklista nie jest jeszcze dostępna.</Empty>}
          {discs.map(disc => <section key={disc} className="mb-6 last:mb-0">
            {discs.length > 1 && <h3 className="mb-4 font-bold">Płyta {disc}</h3>}
            <ol className="space-y-4">{tracks.filter(track => track.disc_number === disc).map(track => <li id={`track-${track.id}`} key={track.id} className="flex scroll-mt-6 gap-3 border-b border-zinc-100 pb-4 sm:gap-4">
              <span className="w-7 shrink-0 pt-1 text-sm font-bold text-zinc-400">{track.track_number}</span>
              <div className="min-w-0 flex-1">{track.spotify_id ? <a href={`https://open.spotify.com/track/${encodeURIComponent(track.spotify_id)}`} target="_blank" rel="noopener noreferrer" className="break-words font-semibold hover:underline">{track.title}<span className="sr-only"> — otwórz w Spotify w nowej karcie</span></a> : <p className="break-words font-semibold">{track.title}</p>}
                <p className="mt-1 text-sm text-zinc-500"><ArtistLinks artists={orderedArtists(track.credits)} /></p>
              </div><span className="pt-1 text-sm tabular-nums text-zinc-500">{duration(track.duration_ms)}</span>
            </li>)}</ol>
          </section>)}
        </div>
        <AlbumCommunitySection albumId={album.id} community={community} viewer={viewer} viewerState={viewerState} returnPath={`/album/${slug}`} />
      </div>
    </section>
  </main>;
}
