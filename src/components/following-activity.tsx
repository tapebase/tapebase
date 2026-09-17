"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import type { FollowingActivityItem } from "@/lib/follows";

const INITIAL_VISIBLE_ITEMS = 3;
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });

function ActivityArtwork({ src, alt }: { src: string | null; alt: string }) {
  return <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100">
    {src ? <Image src={src} alt={alt} fill unoptimized className="object-contain" sizes="56px" />
      : <div role="img" aria-label={alt} className="flex h-full items-center justify-center p-1 text-center text-[10px] text-zinc-500">Brak grafiki</div>}
  </div>;
}

function activityText(item: FollowingActivityItem) {
  if (item.kind === "album_rating") return <>ocenia album <strong>{item.target_title}</strong> na <strong>{item.rating?.toFixed(1)}</strong></>;
  if (item.kind === "artist_rating") return <>ocenia artystę <strong>{item.target_title}</strong> na <strong>{item.rating?.toFixed(1)}</strong></>;
  if (item.kind === "album_added") return <>dodaje album <strong>{item.target_title}</strong></>;
  return <>komentuje {item.target_type === "album" ? "album" : "artystę"} <strong>{item.target_title}</strong></>;
}

export function FollowingActivity({ items }: { items: FollowingActivityItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenItemsCount = items.length - INITIAL_VISIBLE_ITEMS;

  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-black">Aktywność obserwowanych</h2>
    {items.length ? <>
      <ol id="following-activity-list" className="mt-4 space-y-3">{visibleItems.map((item, index) => {
        const targetHref = `/${item.target_type}/${item.target_slug}`;
        return <li key={`${item.kind}-${item.actor_id}-${item.occurred_at}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-start gap-3 rounded-xl border border-zinc-100 p-4">
          <Link href={`/u/${encodeURIComponent(item.username)}`}><UserAvatar username={item.username} src={item.avatar_url} /></Link>
          <div className="min-w-0">
            <p className="text-sm"><Link href={`/u/${encodeURIComponent(item.username)}`} className="font-black hover:underline">@{item.username}</Link> {activityText(item)}</p>
            {item.content && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-600">{item.content}</p>}
            <time className="mt-2 block text-xs text-zinc-500" dateTime={item.occurred_at}>{date.format(new Date(item.occurred_at))}</time>
          </div>
          <Link href={targetHref}><ActivityArtwork src={item.target_image_url} alt={item.target_title} /></Link>
        </li>;
      })}</ol>
      {hiddenItemsCount > 0 && <button
        type="button"
        aria-controls="following-activity-list"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold transition hover:bg-zinc-50"
      >
        {expanded ? "Pokaż mniej" : `Pokaż pozostałe (${hiddenItemsCount})`}
      </button>}
    </> : <p className="mt-4 text-zinc-500">Zaobserwuj użytkowników, aby zobaczyć tutaj ich oceny, komentarze i dodane albumy.</p>}
  </section>;
}
