import Link from "next/link";
import { Artwork } from "@/components/catalog";
import { RatingStars } from "@/components/community-controls";
import { UserAvatar } from "@/components/user-avatar";
import type { PublicProfileActivity } from "@/lib/profiles";
import { albumPath, artistPath } from "@/lib/catalog-format";

const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });

function RatingValue({ value }: { value: number }) {
  return <div className="shrink-0 text-right"><strong className="text-xl font-black text-amber-600">{value.toFixed(1)}</strong><div className="hidden sm:block"><RatingStars value={value} size="small" label={`Ocena ${value.toFixed(1)} na 10`} /></div></div>;
}

export function ProfileHero({ activity, email, own = false }: { activity: PublicProfileActivity; email?: string | null; own?: boolean }) {
  const { profile } = activity;
  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <UserAvatar username={profile.username} src={profile.avatar_url} size="large" />
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">{own ? "Twój profil" : "Profil użytkownika"}</p>
        <h1 className="mt-2 break-words text-4xl font-black">@{profile.username}</h1>
        {email && <p className="mt-2 text-zinc-500">{email}</p>}
        <p className="mt-3 text-sm text-zinc-500">W TAPEBASE od {date.format(new Date(profile.created_at))}</p>
        {own && <div className="mt-4 flex flex-wrap gap-3"><Link href="/zglos" className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Zgłoś album / artystę</Link><Link href={`/u/${profile.username}`} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold">Zobacz profil publiczny →</Link></div>}
      </div>
    </div>
    <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Średnia ocen</dt><dd className="mt-1 text-3xl font-black">{activity.averageRating === null ? "—" : activity.averageRating.toFixed(1)}</dd></div>
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Liczba ocen</dt><dd className="mt-1 text-3xl font-black">{activity.ratingCount}</dd></div>
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Przesłuchane</dt><dd className="mt-1 text-3xl font-black">{activity.listenedCount}</dd></div>
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Komentarze</dt><dd className="mt-1 text-3xl font-black">{activity.commentCount}</dd></div>
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Dodane albumy</dt><dd className="mt-1 text-3xl font-black">{activity.addedAlbumCount}</dd></div>
      <div className="rounded-2xl bg-zinc-50 p-4"><dt className="text-sm text-zinc-500">Dodane biografie</dt><dd className="mt-1 text-3xl font-black">{activity.addedBiographyCount}</dd></div>
    </dl>
  </section>;
}

export function ProfileActivitySections({ activity }: { activity: PublicProfileActivity }) {
  return <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-black">Oceny albumów</h2>
      {activity.albumRatings.length ? <ul className="mt-4 space-y-3">{activity.albumRatings.map(row => <li key={row.album.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-100 p-3">
        <Link href={albumPath(row.album)}><Artwork src={row.album.cover_url} alt={`Okładka albumu ${row.album.title}`} /></Link>
        <Link href={albumPath(row.album)} className="min-w-0 truncate font-bold hover:underline">{row.album.title}</Link>
        <RatingValue value={row.rating} />
      </li>)}</ul> : <p className="mt-4 text-zinc-500">Brak ocen albumów.</p>}
    </section>

    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-black">Oceny artystów</h2>
      {activity.artistRatings.length ? <ul className="mt-4 space-y-3">{activity.artistRatings.map(row => <li key={row.artist.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-100 p-3">
        <Link href={artistPath(row.artist)}><Artwork src={row.artist.image_url} alt={`Zdjęcie: ${row.artist.name || "artysta"}`} /></Link>
        <Link href={artistPath(row.artist)} className="min-w-0 truncate font-bold hover:underline">{row.artist.name || "Artysta bez nazwy"}</Link>
        <RatingValue value={row.rating} />
      </li>)}</ul> : <p className="mt-4 text-zinc-500">Brak ocen artystów.</p>}
    </section>

    <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
      <h2 className="text-2xl font-black">Komentarze</h2>
      {activity.comments.length ? <ol className="mt-4 space-y-3">{activity.comments.map(comment => { const href = comment.album ? albumPath(comment.album) : comment.artist ? artistPath(comment.artist) : "#"; const title = comment.album?.title ?? comment.artist?.name ?? "Komentarz"; return <li key={comment.id} className="rounded-xl border border-zinc-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`${href}#comment-${comment.id}`} className="font-bold hover:underline">{title}</Link><time className="text-xs text-zinc-500" dateTime={comment.created_at}>{date.format(new Date(comment.created_at))}</time></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-zinc-700">{comment.content}</p>
      </li>; })}</ol> : <p className="mt-4 text-zinc-500">Brak komentarzy.</p>}
    </section>

    <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
      <h2 className="text-2xl font-black">Przesłuchane albumy</h2>
      {activity.listened.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{activity.listened.map(row => <li key={row.album.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-zinc-100 p-3">
        <Link href={albumPath(row.album)}><Artwork src={row.album.cover_url} alt={`Okładka albumu ${row.album.title}`} /></Link>
        <Link href={albumPath(row.album)} className="min-w-0 truncate font-bold hover:underline">{row.album.title}</Link>
      </li>)}</ul> : <p className="mt-4 text-zinc-500">Brak przesłuchanych albumów.</p>}
    </section>
  </div>;
}
