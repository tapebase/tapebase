import Link from "next/link";
import { Artwork } from "@/components/catalog";
import { ExpandableList } from "@/components/expandable-list";
import type { PublicPlaylistSummary } from "@/lib/user-lists";

function PlaylistCover({ playlist }: { playlist: PublicPlaylistSummary }) {
  if (playlist.cover_url) return <Artwork src={playlist.cover_url} alt={`Okładka playlisty ${playlist.name}`} className="rounded-xl" />;
  return <div className="grid aspect-square grid-cols-2 overflow-hidden rounded-xl bg-zinc-100">
    {playlist.sample_cover_urls.length ? <>
      {playlist.sample_cover_urls.map((cover, index) => <Artwork key={`${cover}-${index}`} src={cover} alt="Okładka albumu z playlisty" className="rounded-none" />)}
      {Array.from({ length: 4 - playlist.sample_cover_urls.length }, (_, index) => <div key={`empty-${index}`} className="border border-white/40 bg-zinc-100" />)}
    </> : <div className="col-span-2 flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-zinc-500">Pusta playlista</div>}
  </div>;
}

export function LatestPlaylists({ playlists }: { playlists: PublicPlaylistSummary[] }) {
  return <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-labelledby="latest-playlists-heading">
    <div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="latest-playlists-heading" className="text-2xl font-black">Ostatnio utworzone playlisty</h2>
          <p className="mt-1 text-sm text-zinc-500">Najnowsze publiczne playlisty społeczności</p>
        </div>
        <Link href="/listy" className="text-sm font-semibold underline">Utwórz własną playlistę</Link>
      </div>
      {playlists.length ? <ExpandableList initialVisible={3} moreLabel="Pokaż więcej playlist" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map(playlist => <li key={playlist.id} className="min-w-0 rounded-2xl border border-zinc-100 p-4">
          <Link href={`/lista/${playlist.id}`}>
            <PlaylistCover playlist={playlist} />
            <h3 className="mt-4 truncate text-lg font-black hover:underline">{playlist.name}</h3>
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <Link href={`/u/${encodeURIComponent(playlist.username)}`} className="font-semibold hover:underline">@{playlist.username}</Link>
            <span>{playlist.track_count} {playlist.track_count === 1 ? "utwór" : "utworów"}</span>
          </div>
          {playlist.description && <p className="mt-3 line-clamp-2 text-sm text-zinc-600">{playlist.description}</p>}
        </li>)}
      </ExpandableList> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Nie utworzono jeszcze żadnej publicznej playlisty.</p>}
    </div>
  </section>;
}
