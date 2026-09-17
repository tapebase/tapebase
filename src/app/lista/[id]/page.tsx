import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getUserListById, getUserListRating } from "@/lib/user-lists";
import { Artwork } from "@/components/catalog";
import { albumPath } from "@/lib/catalog-format";
import { removeAlbumFromUserList, removeTrackFromUserList } from "@/app/actions/user-lists";
import { DeleteUserListForm, EditUserListForm } from "@/components/user-list-forms";
import { SpotifyPlaylistExport } from "@/components/spotify-playlist-export";
import { spotifyConnectionStatus } from "@/lib/spotify-user";
import { PlaylistCoverEditor } from "@/components/playlist-cover-editor";
import { PlaylistRatingPanel } from "@/components/community-controls";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ spotify?: string }> };

export async function generateMetadata({ params }: Props) {
  const id = Number((await params).id);
  const list = await getUserListById(id, false);
  return { title: list?.name ?? "Lista" };
}

export default async function UserListPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const viewer = await getViewer();
  const list = await getUserListById(id, Boolean(viewer));
  if (!list) notFound();
  const own = viewer?.id === list.user_id;
  const itemCount = list.kind === "albums" ? list.albumItems.length : list.trackItems.length;
  const spotify = own && list.kind === "tracks" && viewer
    ? await spotifyConnectionStatus(viewer.id)
    : null;
  const spotifyStatus = (await searchParams)?.spotify;
  const rating = list.kind === "tracks" && list.is_public
    ? await getUserListRating(list.id, viewer?.id ?? null)
    : null;

  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <Link href={own ? "/listy" : `/u/${encodeURIComponent(list.owner?.username ?? "")}`} className="text-sm font-bold hover:underline">← {own ? "Twoje listy" : "Profil autora"}</Link>
    <header className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-start">
        <Artwork src={list.cover_url} alt={`Okładka listy ${list.name}`} className="rounded-2xl" priority />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{list.kind === "albums" ? "Lista albumów" : "Playlista utworów"} · {list.is_public ? "publiczna" : "prywatna"}</p><h1 className="mt-2 break-words text-4xl font-black">{list.name}</h1>{list.owner && <Link href={`/u/${encodeURIComponent(list.owner.username)}`} className="mt-3 inline-block font-bold hover:underline">@{list.owner.username}</Link>}</div>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold">{itemCount} {list.kind === "albums" ? (itemCount === 1 ? "album" : "albumów") : (itemCount === 1 ? "utwór" : "utworów")}</span>
          </div>
          {list.description && <p className="mt-5 max-w-3xl whitespace-pre-wrap text-zinc-600">{list.description}</p>}
          {own && <Link href={list.kind === "tracks" ? `/utwory?lista=${list.id}` : "/album"} className="mt-5 inline-flex rounded-xl bg-zinc-950 px-5 py-3 font-bold text-white">
            {list.kind === "tracks" ? "Dodaj utwory" : "Dodaj albumy"}
          </Link>}
        </div>
      </div>
    </header>

    {rating && <PlaylistRatingPanel
      listId={list.id}
      average={rating.average}
      ratingCount={rating.ratingCount}
      initialRating={rating.viewerRating}
      canRate={Boolean(viewer && !own)}
      returnPath={`/lista/${list.id}`}
      disabledMessage={own ? "Autor nie może ocenić własnej playlisty." : undefined}
    />}

    {list.kind === "albums" ? <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Albumy</h2>
      {list.albumItems.length ? <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.albumItems.map((item, index) => <li key={item.album.id} className="relative min-w-0 rounded-2xl border border-zinc-100 p-4">
        <span className="absolute left-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950 px-2 text-sm font-black text-white shadow">{index + 1}</span>
        <Link href={albumPath(item.album)}><Artwork src={item.album.cover_url} alt={`Okładka albumu ${item.album.title}`} /><h3 className="mt-4 truncate font-black hover:underline">{item.album.title}</h3></Link>
        {own && <form action={removeAlbumFromUserList.bind(null, list.id, item.album.id)}><button className="mt-3 text-sm font-semibold text-red-700 hover:underline">Usuń z listy</button></form>}
      </li>)}</ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Ta lista nie zawiera jeszcze albumów.</p>}
    </section> : <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-black">Utwory</h2>
      {list.trackItems.length ? <ol className="mt-5 space-y-3">{list.trackItems.map((item, index) => <li key={item.track.id} className="flex items-center gap-4 rounded-2xl border border-zinc-100 p-3">
        <span className="w-7 shrink-0 text-center text-sm font-black text-zinc-400">{index + 1}</span>
        {item.track.album && <Link href={albumPath(item.track.album)} className="w-14 shrink-0"><Artwork src={item.track.album.cover_url} alt={`Okładka albumu ${item.track.album.title}`} /></Link>}
        <div className="min-w-0 flex-1">
          {item.track.spotify_id ? <a href={`https://open.spotify.com/track/${encodeURIComponent(item.track.spotify_id)}`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">{item.track.title}</a> : <p className="font-bold">{item.track.title}</p>}
          <p className="mt-1 text-sm text-zinc-500">{item.track.credits.map((credit, artistIndex) => <span key={credit.artist?.id ?? artistIndex}>{artistIndex > 0 && ", "}{credit.artist ? <Link href={`/artist/${credit.artist.slug ?? credit.artist.id}`} className="hover:underline">{credit.artist.name ?? "Artysta"}</Link> : "Artysta"}</span>)}</p>
          {item.track.album && <Link href={albumPath(item.track.album)} className="mt-1 block truncate text-xs text-zinc-500 hover:underline">{item.track.album.title}</Link>}
        </div>
        {own && <form action={removeTrackFromUserList.bind(null, list.id, item.track.id)}><button className="text-sm font-semibold text-red-700 hover:underline">Usuń utwór</button></form>}
      </li>)}</ol> : <p className="mt-5 rounded-2xl bg-zinc-50 p-5 text-zinc-600">Ta playlista nie zawiera jeszcze utworów. Dodasz je z tracklist albumów.</p>}
    </section>}

    {own && list.kind === "tracks" && spotify && <SpotifyPlaylistExport
      listId={list.id}
      connected={spotify.connected}
      canUploadCover={spotify.canUploadCover}
      coverUrl={list.cover_url}
      playlistUrl={list.spotify_playlist_url}
      callbackStatus={spotifyStatus}
    />}

    {own && <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <PlaylistCoverEditor listId={list.id} name={list.name} coverUrl={list.cover_url} />
      <div className="mt-5">
      <EditUserListForm id={list.id} name={list.name} description={list.description} isPublic={list.is_public} kind={list.kind} />
      </div>
      <DeleteUserListForm id={list.id} />
    </section>}
  </main>;
}
