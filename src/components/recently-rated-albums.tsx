"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type RecentlyRatedAlbumCard = {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  average: number;
  recentRatingCount: number;
};

type PageResponse = {
  items?: RecentlyRatedAlbumCard[];
  hasMore?: boolean;
  error?: string;
};

const PAGE_SIZE = 10;

function AlbumArtwork({ album }: { album: RecentlyRatedAlbumCard }) {
  return <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100">
    {album.cover_url ? <Image src={album.cover_url} alt={`Okładka albumu ${album.title}`} fill unoptimized className="object-contain" sizes="(max-width: 640px) 90vw, 320px" />
      : <div role="img" aria-label={`Okładka albumu ${album.title}`} className="flex h-full items-center justify-center p-3 text-center text-sm text-zinc-500">Brak grafiki</div>}
  </div>;
}

export function RecentlyRatedAlbums({ initialItems, initialHasMore }: {
  initialItems: RecentlyRatedAlbumCard[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [visibleCount, setVisibleCount] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  async function showMore() {
    const cachedItems = items.length - visibleCount;
    if (cachedItems > 0) {
      setVisibleCount(count => count + Math.min(PAGE_SIZE, cachedItems));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/recently-rated?offset=${items.length}`);
      const page = await response.json() as PageResponse;
      if (!response.ok || !page.items || typeof page.hasMore !== "boolean") {
        throw new Error(page.error || "Nie udało się pobrać rankingu.");
      }
      const nextItems = page.items;
      setItems(current => [...current, ...nextItems.filter(album => !current.some(item => item.id === album.id))]);
      setVisibleCount(count => count + nextItems.length);
      setHasMore(page.hasMore);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się pobrać rankingu.");
    } finally {
      setLoading(false);
    }
  }

  const canShowMore = visibleCount < items.length || hasMore;
  return <>
    <ol id={listId} className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.slice(0, visibleCount).map((album, index) => <li key={album.id} className="relative min-w-0 overflow-hidden rounded-2xl border border-zinc-100 p-3 sm:p-4">
        <span className="absolute left-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950 px-2 text-sm font-black text-white shadow">{index + 1}</span>
        <Link href={`/album/${encodeURIComponent(album.slug)}`} aria-label={`Album: ${album.title}`} className="block min-w-0 max-w-full">
          <AlbumArtwork album={album} />
          <h3 className="mt-4 truncate font-black hover:underline">{album.title}</h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-amber-600">★ {album.average.toFixed(1)}</p>
          <p className="text-xs text-zinc-500">{album.recentRatingCount} {album.recentRatingCount === 1 ? "ocena" : "ocen"} w 7 dni</p>
        </div>
      </li>)}
    </ol>
    <div className="mt-5 flex flex-wrap gap-3">
      {canShowMore && <button type="button" aria-controls={listId} onClick={showMore} disabled={loading}
        className="min-w-48 flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold transition hover:bg-zinc-50 disabled:opacity-60">
        {loading ? "Ładowanie…" : "Pokaż kolejne 10"}
      </button>}
      {visibleCount > PAGE_SIZE && <button type="button" aria-controls={listId} onClick={() => setVisibleCount(PAGE_SIZE)}
        className="min-w-48 flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold transition hover:bg-zinc-50">
        Zwiń do Top 10
      </button>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
  </>;
}
