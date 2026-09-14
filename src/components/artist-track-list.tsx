"use client";

import { useState } from "react";
import Link from "next/link";
import type { Participation } from "@/lib/catalog";
import { albumPath } from "@/lib/catalog-format";

const INITIAL_TRACK_COUNT = 10;

export function ArtistTrackList({ participations }: { participations: Participation[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? participations : participations.slice(0, INITIAL_TRACK_COUNT);
  const hiddenCount = Math.max(0, participations.length - INITIAL_TRACK_COUNT);

  return <>
    <ul className="space-y-4">{visible.map(({ track }, index) => track && <li key={track.id || index} className="border-b border-zinc-100 pb-4">
      {track.album ? <Link href={`${albumPath(track.album)}#track-${track.id}`} className="font-semibold hover:underline">{track.title}<span className="mt-1 block text-sm font-normal text-zinc-500">{track.album.title}</span></Link> : track.title}
    </li>)}</ul>
    {hiddenCount > 0 && <button
      type="button"
      onClick={() => setExpanded(value => !value)}
      aria-expanded={expanded}
      className="mt-6 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-bold transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
    >
      {expanded ? "Zwiń listę" : `Pokaż wszystkie (${participations.length})`}
    </button>}
  </>;
}
