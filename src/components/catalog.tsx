import Image from "next/image";
import Link from "next/link";
import type { Album, Artist } from "@/lib/catalog";
import { pageSize } from "@/lib/catalog";
import { albumPath, artistPath, orderedArtists, releaseDate } from "@/lib/catalog-format";
import { getViewer } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { FeedbackLink } from "@/components/feedback-link";

export async function Header() {
  const viewer = await getViewer();
  let unreadNotifications = 0;
  if (viewer) {
    const client = await createClient();
    const { count } = await client.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id).is("read_at", null);
    unreadNotifications = count ?? 0;
  }
  return <header className="border-b border-zinc-200 bg-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
      <Link href="/" className="text-2xl font-black tracking-tight">TAPEBASE</Link>
      <nav aria-label="Menu główne" className="flex flex-wrap items-center gap-5 text-sm font-semibold">
        <Link href="/album">Albumy</Link><Link href="/artist">Artyści</Link>
        <div className="group relative">
          <Link href="/rankingi" className="inline-flex items-center gap-1 py-2" aria-haspopup="true">Rankingi <span aria-hidden="true" className="text-xs">▾</span></Link>
          <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
              <Link href="/rankingi?typ=artysci" className="block rounded-lg px-4 py-3 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:text-zinc-950">TOP artystów</Link>
              <Link href="/rankingi?typ=albumy" className="block rounded-lg px-4 py-3 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:bg-zinc-100 focus-visible:text-zinc-950">TOP albumów</Link>
            </div>
          </div>
        </div>
        <Link href="/#ostatnio-dodane">Ostatnio dodane</Link>
        <Link href="/zglos">Zgłoś album / artystę</Link>
        {viewer && <FeedbackLink />}
      </nav>{viewer ? <div className="flex items-center gap-4 text-sm">{viewer.role === "admin" && <Link href="/admin/zgloszenia" className="font-bold">Administracja</Link>}<Link href="/powiadomienia" aria-label={unreadNotifications > 0 ? `Powiadomienia: ${unreadNotifications} nieprzeczytanych` : "Powiadomienia"} title="Powiadomienia" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
      </Link><Link href="/profil" className="font-bold">@{viewer.username}</Link><form action={signOut}><button className="text-zinc-600 hover:underline">Wyloguj</button></form></div> : <Link href="/login" className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">Zaloguj się</Link>}
    </div>
  </header>;
}
export function Artwork({ src, alt, className = "", priority = false, variant = "default" }: {
  src: string | null; alt: string; className?: string; priority?: boolean; variant?: "default" | "artistProfile";
}) {
  const artistProfile = variant === "artistProfile";
  return <div className={`relative overflow-hidden ${artistProfile ? "h-56 w-56 shrink-0 self-start" : "aspect-square rounded-lg bg-zinc-100"} ${className}`}>
    {src ? <Image src={src} alt={alt} fill unoptimized loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} className={artistProfile ? "object-cover" : "object-contain"} sizes={artistProfile ? "224px" : "(max-width: 640px) 90vw, 320px"} />
      : <div role="img" aria-label={alt} className="flex h-full items-center justify-center p-3 text-center text-sm text-zinc-500">Brak grafiki</div>}
  </div>;
}
export function SpotifyLink({ id, type, label = "Otwórz w Spotify" }: { id: string | null; type: "album" | "artist" | "track"; label?: string }) {
  if (!id) return null;
  return <a href={`https://open.spotify.com/${type}/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer"
    className="inline-flex flex-wrap items-center gap-4 py-3 text-xs font-semibold underline-offset-4 hover:underline">
    <Image src="/spotify-logo.svg" alt="Spotify" width={80} height={24} className="h-auto w-20" />
    <span>{label}<span className="sr-only"> (nowa karta)</span></span>
  </a>;
}
export function ArtistLinks({ artists }: { artists: Artist[] }) {
  if (!artists.length) return <span>Wykonawca nieznany</span>;
  return artists.map((artist, index) => <span key={artist.id}>
    {index > 0 && ", "}<Link href={artistPath(artist)} className="hover:underline">{artist.name || "Artysta bez nazwy"}</Link>
  </span>);
}
export function AlbumCard({ album }: { album: Album }) {
  return <article className="min-w-0 rounded-2xl border border-zinc-100 p-4">
    <Link href={albumPath(album)} aria-label={`Album: ${album.title}`}>
      <Artwork src={album.cover_url} alt={`Okładka albumu ${album.title}`} />
      <h3 className="mt-4 break-words text-lg font-bold hover:underline">{album.title}</h3>
    </Link>
    <p className="mt-1 text-sm text-zinc-600"><ArtistLinks artists={orderedArtists(album.credits, album.primary_artist)} /></p>
    <p className="mt-2 text-sm text-zinc-500">{album.album_type === "ep" ? "EP" : "Album"} · {releaseDate(album)}</p>
  </article>;
}
export function ArtistCard({ artist }: { artist: Artist }) {
  return <article className="min-w-0 rounded-2xl border border-zinc-100 p-4">
    <Link href={artistPath(artist)}>
      <Artwork src={artist.image_url} alt={`Zdjęcie: ${artist.name || "artysta"}`} />
      <h3 className="mt-4 break-words font-bold hover:underline">{artist.name || "Artysta bez nazwy"}</h3>
    </Link>
  </article>;
}
export function SearchForm({ action, query, label, hidden = {} }: { action: string; query: string; label: string; hidden?: Record<string, string> }) {
  return <form action={action} className="my-6 flex max-w-2xl flex-col gap-3 sm:flex-row" role="search">
    {Object.entries(hidden).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
    <label className="flex-1"><span className="sr-only">{label}</span><input type="search" name="q" defaultValue={query} placeholder={label} maxLength={100}
      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4" /></label>
    <button className="rounded-2xl bg-zinc-950 px-6 py-4 font-bold text-white">Szukaj</button>
  </form>;
}
export function Pagination({ path, page, count, query = "", pageKey = "page", other = {} }: {
  path: string; page: number; count: number; query?: string; pageKey?: string; other?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages === 1 && page === 1) return null;
  const href = (next: number) => {
    const params = new URLSearchParams(other);
    if (query) params.set("q", query);
    params.set(pageKey, String(next));
    return `${path}?${params}`;
  };
  return <nav aria-label="Strony wyników" className="mt-6 flex flex-wrap items-center gap-5 text-sm font-semibold">
    {page > 1 && <Link href={href(Math.min(page - 1, pages))}>← Poprzednia</Link>}
    <span>Strona {page} · liczba stron: {pages}</span>
    {page < pages && <Link href={href(page + 1)}>Następna →</Link>}
  </nav>;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-zinc-50 p-6 text-zinc-600">{children}</p>;
}
